class PayrollReportTool < RubyLLM::Tool
  description "Builds a paginated employee, salary-increase, or headcount report from records the current user is allowed to access."

  parameters type: "object",
    properties: {
      report_type: { type: "string", enum: %w[employees salary_increases headcount], description: "Which in-app report to produce." },
      after_date: { type: "string", description: "For salary_increases, include changes strictly after this ISO date; otherwise use an empty string." },
      department: { type: "string", description: "Exact department name filter, or an empty string." },
      country_code: { type: "string", description: "Two-letter country code filter, or an empty string." },
      status: { type: "string", enum: %w[all active leave terminated], description: "Employee status filter." },
      group_by: { type: "string", enum: %w[none department country status month], description: "Optional chart grouping. Use month only for salary increases." },
      chart_type: { type: "string", enum: %w[bar pie], description: "Chart style requested by the user." },
      include_rows: { type: "boolean", description: "Whether the user asked for individual employee or salary-change rows." },
      include_chart: { type: "boolean", description: "Whether the user explicitly requested a chart." },
      page: { type: "integer", description: "One-based result page." }
    },
    required: %w[report_type after_date department country_code status group_by chart_type include_rows include_chart page],
    additionalProperties: false

  def initialize(employee_scope:, page_override: nil, chart_type_override: nil, include_rows_override: nil)
    @employee_scope = employee_scope
    @page_override = page_override
    @chart_type_override = chart_type_override
    @include_rows_override = include_rows_override
    @result = nil
  end

  attr_reader :result

  def execute(report_type:, after_date:, department:, country_code:, status:, group_by:, chart_type:, include_rows:, include_chart:, page:)
    report_type = allowed(report_type, %w[employees salary_increases headcount], "employees")
    status = allowed(status, %w[all active leave terminated], "all")
    group_by = allowed(group_by, %w[none department country status month], "none")
    chart_type = allowed(@chart_type_override || chart_type, %w[bar pie], "bar")
    include_rows = @include_rows_override.nil? ? include_rows == true : @include_rows_override
    page = page_number(@page_override || page)

    records = report_type == "salary_increases" ? salary_increases(after_date, department, country_code, status) : employee_records(department, country_code, status)
    total = records.count
    page_size = 25
    total_pages = [(total.to_f / page_size).ceil, 1].max
    page = [page, total_pages].min
    rows = if include_rows
      report_type == "salary_increases" ? increment_rows(records, page, page_size) : employee_rows(records, page, page_size)
    else
      []
    end
    chart = include_chart ? chart_data(records, report_type, group_by) : []
    title = report_title(report_type, after_date)

    @result = {
      report_type:,
      title:,
      total:,
      page:,
      per_page: page_size,
      total_pages:,
      rows:,
      show_table: include_rows,
      chart:,
      chart_type:,
      chart_group: group_by == "none" ? nil : group_by
    }
    @result.except(:rows)
  end

  private

  def employee_records(department, country_code, status)
    records = @employee_scope.joins(:department, :country)
    records = records.where(departments: { name: department.to_s.first(100) }) if department.present?
    records = records.where(countries: { code: country_code.to_s.upcase.first(2) }) if country_code.present?
    records = records.where(status:) if status != "all"
    records
  end

  def salary_increases(after_date, department, country_code, status)
    records = SalaryRecord.joins(employee: %i[department country])
      .where(employees: { id: @employee_scope.select(:id) })
      .where(<<~SQL.squish)
        salary_records.amount > (
          SELECT previous.amount
          FROM salary_records previous
          WHERE previous.employee_id = salary_records.employee_id
            AND previous.effective_from < salary_records.effective_from
          ORDER BY previous.effective_from DESC, previous.id DESC
          LIMIT 1
        )
      SQL
    records = records.where("salary_records.effective_from > ?", Date.iso8601(after_date.to_s)) if after_date.present?
    records = records.where(departments: { name: department.to_s.first(100) }) if department.present?
    records = records.where(countries: { code: country_code.to_s.upcase.first(2) }) if country_code.present?
    records = records.where(employees: { status: }) if status != "all"
    records
  rescue Date::Error
    SalaryRecord.none
  end

  def employee_rows(records, page, page_size)
    records.includes(:department, :country).order(:last_name, :first_name, :id)
      .limit(page_size).offset((page - 1) * page_size).map do |employee|
        {
          employee_number: employee.employee_number,
          employee: "#{employee.first_name} #{employee.last_name}",
          job_title: employee.job_title,
          department: employee.department.name,
          country: employee.country.name,
          status: employee.status
        }
      end
  end

  def increment_rows(records, page, page_size)
    records.includes(employee: %i[department country]).order("salary_records.effective_from ASC", "salary_records.id ASC")
      .limit(page_size).offset((page - 1) * page_size).map do |record|
        previous_amount = record.employee.salary_records
          .where("effective_from < ?", record.effective_from)
          .order(effective_from: :desc, id: :desc).limit(1).pick(:amount)
        {
          employee_number: record.employee.employee_number,
          employee: "#{record.employee.first_name} #{record.employee.last_name}",
          department: record.employee.department.name,
          country: record.employee.country.name,
          effective_from: record.effective_from.iso8601,
          previous_amount:,
          amount: record.amount,
          currency: record.currency,
          reason: record.reason
        }
      end
  end

  def chart_data(records, report_type, group_by)
    return [] if group_by == "none"
    return [] if group_by == "month" && report_type != "salary_increases"

    groups = case group_by
    when "department" then records.group("departments.name").count
    when "country" then records.group("countries.name").count
    when "status" then report_type == "salary_increases" ? records.group("employees.status").count : records.group(:status).count
    when "month" then records.group(Arel.sql("strftime('%Y-%m', salary_records.effective_from)")).count
    else {}
    end
    groups.sort_by { |label, _count| label.to_s }.map { |label, count| { label: label.presence || "Unknown", value: count } }
  end

  def report_title(report_type, after_date)
    case report_type
    when "salary_increases" then after_date.present? ? "Salary increases after #{Date.iso8601(after_date.to_s).iso8601}" : "Salary increases"
    when "headcount" then "Employee headcount"
    else "Employee list"
    end
  end

  def allowed(value, values, fallback)
    normalized = value.to_s.downcase
    values.include?(normalized) ? normalized : fallback
  end

  def page_number(value)
    [[Integer(value, exception: false) || 1, 1].max, 10_000].min
  end
end
