class EmployeeDirectory
  SORT_COLUMNS = %w[employee_number first_name last_name country_code department job_title status hired_on].freeze
  Result = Struct.new(:employees, :meta, keyword_init: true)

  def initialize(filters:)
    @filters = filters
  end

  def call
    records = filtered_employees
    total = records.count
    per_page = [[integer_filter(:per_page, 25), 1].max, 100].min
    total_pages = (total.to_f / per_page).ceil
    page = [[integer_filter(:page, 1), 1].max, [total_pages, 1].max].min
    selected = records.order(sort_column => sort_direction, id: :asc)
      .limit(per_page).offset((page - 1) * per_page).to_a
    salaries = current_salaries_for(selected.map(&:id))

    Result.new(
      employees: selected.map { |employee| [employee, salaries[employee.id]] },
      meta: { page:, per_page:, total:, total_pages: }
    )
  end

  private

  def filtered_employees
    employees = Employee.all
    employees = employees.where(status: @filters[:status]) if Employee::STATUSES.include?(@filters[:status])
    country = @filters[:country]
    employees = employees.where(country_code: country.upcase) if country.is_a?(String) && country.present?
    department = @filters[:department]
    employees = employees.where(department:) if department.is_a?(String) && department.present?
    query = @filters[:q]
    return employees unless query.is_a?(String) && query.present?

    term = "%#{ActiveRecord::Base.sanitize_sql_like(query.strip)}%"
    employees.where("employee_number LIKE :term OR first_name LIKE :term OR last_name LIKE :term OR email LIKE :term", term:)
  end

  def sort_column
    SORT_COLUMNS.include?(@filters[:sort]) ? @filters[:sort] : "last_name"
  end

  def sort_direction
    @filters[:direction] == "asc" ? :asc : :desc
  end

  def integer_filter(key, default)
    Integer(@filters[key], exception: false) || default
  end

  def current_salaries_for(employee_ids)
    return {} if employee_ids.empty?

    SalaryRecord.effective_on(Date.current).where(employee_id: employee_ids)
      .order(effective_from: :desc, id: :desc).index_by(&:employee_id)
  end
end
