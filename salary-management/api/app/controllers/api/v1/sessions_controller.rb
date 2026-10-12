module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate_user!, only: :create

      def create
        user = User.find_by(email: params[:email].to_s.strip.downcase)
        return render json: { error: "Invalid email or password" }, status: :unauthorized unless user&.authenticate(params[:password])

        render json: session_payload(user)
      end

      def show
        render json: session_payload(current_user)
      end

      private

      def session_payload(user)
        {
          token: Sessions::SessionToken.issue(user),
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            organization: { id: user.organization_id, name: user.organization.name, slug: user.organization.slug }
          }
        }
      end
    end
  end
end
