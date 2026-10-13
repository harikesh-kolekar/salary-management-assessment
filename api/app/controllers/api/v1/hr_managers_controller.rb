module Api
  module V1
    class HrManagersController < BaseController
      before_action :require_admin!

      def create
        result = Users::HrManagerCreator.new(organization: current_organization, attributes: hr_manager_params).call
        return render_validation_failure(result.value) unless result.success?

        user = result.value
        render json: { data: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } }, status: :created
      end

      private

      def hr_manager_params
        params.require(:hr_manager).permit(:full_name, :email, :password, :password_confirmation)
      end
    end
  end
end
