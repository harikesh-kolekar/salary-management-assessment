module Api
  module V1
    class OrganizationsController < BaseController
      skip_before_action :authenticate_user!, only: :create

      def create
        result = OrganizationRegistration.new(**registration_params).call
        return render_validation_failure(result.user) unless result.success?

        user = result.user
        render json: {
          token: SessionToken.issue(user),
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug }
          }
        }, status: :created
      end

      private

      def registration_params
        params.require(:organization).permit(:name, :manager_name, :email, :password, :password_confirmation)
          .to_h.symbolize_keys
          .transform_keys { |key| key == :name ? :organization_name : key }
      end
    end
  end
end
