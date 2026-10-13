module Api
  module V1
    class DepartmentsController < BaseController
      before_action :require_admin!, only: %i[create update]

      def index
        render json: { data: visible_departments.includes(:hr_manager).order(:name).map { |department| serialize(department, include_count: true) } }
      end

      def show
        department = visible_departments.includes(:hr_manager).find(params[:id])
        result = Employees::EmployeeDirectory.new(
          organization: current_organization,
          filters: params.permit(:page, :per_page, :sort, :direction),
          employee_scope: visible_employees.where(department_id: department.id)
        ).call
        employees = result.employees.map { |employee, salary| EmployeeSerializer.new(employee, salary_record: salary).as_json }

        render json: {
          data: serialize(department, include_count: true),
          employees: employees,
          meta: result.meta
        }
      end

      def create
        result = Departments::DepartmentWriter.new(organization: current_organization, attributes: department_params).call
        return render_validation_failure(result.value) unless result.success?

        render json: { data: serialize(result.value) }, status: :created
      end

      def update
        result = Departments::DepartmentWriter.new(organization: current_organization, id: params[:id], attributes: department_params).call
        return render_validation_failure(result.value) unless result.success?

        render json: { data: serialize(result.value) }
      end

      private

      def department_params
        params.require(:department).permit(:name, :code, :hr_manager_id)
      end

      def serialize(department, include_count: false)
        payload = { id: department.id, name: department.name, code: department.code, hr_manager: { id: department.hr_manager.id, full_name: department.hr_manager.full_name } }
        payload[:employee_count] = department.employees.count if include_count
        payload
      end
    end
  end
end
