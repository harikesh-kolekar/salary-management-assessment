module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "Not found" }, status: :not_found
      end

      private

      def employee_json(employee, salary_record: nil, include_history: false)
        payload = {
          id: employee.id,
          employee_number: employee.employee_number,
          first_name: employee.first_name,
          last_name: employee.last_name,
          full_name: "#{employee.first_name} #{employee.last_name}",
          email: employee.email,
          country_code: employee.country_code,
          department: employee.department,
          job_title: employee.job_title,
          status: employee.status,
          hired_on: employee.hired_on,
          current_salary: salary_json(salary_record)
        }
        payload[:salary_history] = employee.salary_records.map { |record| salary_json(record) } if include_history
        payload
      end

      def salary_json(record)
        return nil unless record
        { id: record.id, amount: record.amount.to_f, currency: record.currency, effective_from: record.effective_from, reason: record.reason }
      end
    end
  end
end
