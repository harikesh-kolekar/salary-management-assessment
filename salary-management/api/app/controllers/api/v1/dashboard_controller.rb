module Api
  module V1
    class DashboardController < BaseController
      def show
        date = Date.current
        active = Employee.on_roster
        current = SalaryRecord.effective_on(date).joins(:employee).merge(active)
        render json: {
          as_of: date,
          headcount: active.count,
          employee_count: Employee.count,
          by_country: grouped_metrics(current, "employees.country_code"),
          by_department: grouped_metrics(current, "employees.department"),
          by_currency: grouped_metrics(current, "salary_records.currency")
        }
      end

      private

      def grouped_metrics(scope, column)
        # Group dimensions are fixed internal constants, never client-provided SQL.
        scope.group(Arel.sql(column), "salary_records.currency")
          .order(Arel.sql("1 ASC, 2 ASC"))
          .pluck(Arel.sql(column), "salary_records.currency", Arel.sql("COUNT(DISTINCT employees.id)"), Arel.sql("AVG(salary_records.amount)"), Arel.sql("SUM(salary_records.amount)"))
          .map do |key, currency, count, average, total|
            { key: key, currency: currency, employee_count: count, average_salary: average.to_f.round(2), total_salary: total.to_f.round(2) }
          end
      end
    end
  end
end
