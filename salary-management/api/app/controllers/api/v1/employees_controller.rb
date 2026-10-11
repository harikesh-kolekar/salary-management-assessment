module Api
  module V1
    class EmployeesController < BaseController
      def index
        result = EmployeeDirectory.new(filters: directory_params).call
        data = result.employees.map do |employee, salary|
          EmployeeSerializer.new(employee, salary_record: salary).as_json
        end
        render json: { data:, meta: result.meta }
      end

      def show
        employee = Employee.find(params[:id])
        render json: { data: EmployeeSerializer.new(employee, salary_record: employee.current_salary_record, include_history: true).as_json }
      end

      def create
        result = EmployeeCreator.new(
          employee_attributes: employee_params,
          initial_salary_attributes: initial_salary_params_if_present
        ).call

        if result.success?
          render json: { data: EmployeeSerializer.new(result.employee, salary_record: result.employee.current_salary_record, include_history: true).as_json }, status: :created
        else
          render json: { error: "Validation failed", details: result.employee.errors.to_hash }, status: :unprocessable_entity
        end
      end

      def update
        result = EmployeeUpdater.new(id: params[:id], attributes: employee_params).call
        if result.success?
          render json: { data: EmployeeSerializer.new(result.employee, salary_record: result.employee.current_salary_record, include_history: true).as_json }
        else
          render json: { error: "Validation failed", details: result.employee.errors.to_hash }, status: :unprocessable_entity
        end
      end

      private

      def employee_params
        params.require(:employee).permit(:employee_number, :first_name, :last_name, :email, :country_code, :department, :job_title, :status, :hired_on)
      end

      def initial_salary_params_if_present
        params[:initial_salary]&.permit(:amount, :currency, :effective_from, :reason)
      end

      def directory_params
        params.permit(:status, :country, :department, :q, :sort, :direction, :page, :per_page)
      end
    end
  end
end
