module Api
  module V1
    class DepartmentsController < BaseController
      before_action :require_admin!

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

      def serialize(department)
        { id: department.id, name: department.name, code: department.code, hr_manager: { id: department.hr_manager.id, full_name: department.hr_manager.full_name } }
      end
    end
  end
end
