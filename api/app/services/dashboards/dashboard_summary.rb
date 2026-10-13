module Dashboards
  class DashboardSummary
    def initialize(organization:, employee_scope: nil)
      @organization = organization
      @employee_scope = employee_scope || organization.employees
    end

    def call
      date = Date.current
      roster = @employee_scope.on_roster
      current_salaries = SalaryRecord.effective_on(date).joins(employee: [:country, :department]).merge(roster)

      {
        as_of: date,
        headcount: roster.count,
        employee_count: @employee_scope.count,
        by_country: grouped_metrics(current_salaries, "countries.code"),
        by_department: grouped_metrics(current_salaries, "departments.name"),
        by_currency: grouped_metrics(current_salaries, "salary_records.currency")
      }
    end

    private

    def grouped_metrics(scope, column)
      # Dimensions are fixed constants, never client-provided SQL.
      scope.group(Arel.sql(column), "salary_records.currency")
        .order(Arel.sql("1 ASC, 2 ASC"))
        .pluck(Arel.sql(column), "salary_records.currency", Arel.sql("COUNT(DISTINCT employees.id)"), Arel.sql("AVG(salary_records.amount)"), Arel.sql("SUM(salary_records.amount)"))
        .map do |key, currency, count, average, total|
          { key:, currency:, employee_count: count, average_salary: average.to_f.round(2), total_salary: total.to_f.round(2) }
        end
    end
  end
end
