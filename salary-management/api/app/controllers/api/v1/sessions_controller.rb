module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate_user!, only: %i[create refresh destroy]

      def create
        user = User.find_by(email: params[:email].to_s.strip.downcase)
        return render json: { error: "Invalid email or password" }, status: :unauthorized unless user&.authenticate(params[:password])

        refresh = Sessions::RefreshTokenManager.issue(user)
        set_refresh_cookie(refresh.refresh_token)
        render json: session_payload(user)
      end

      def show
        render json: session_payload(current_user)
      end

      def refresh
        rotation = Sessions::RefreshTokenManager.rotate(cookies[REFRESH_COOKIE])
        unless rotation
          clear_refresh_cookie
          return render json: { error: "Authentication required" }, status: :unauthorized
        end

        set_refresh_cookie(rotation.refresh_token)
        render json: { token: Sessions::JwtAuthenticator.issue(rotation.user) }
      end

      def destroy
        Sessions::RefreshTokenManager.revoke(cookies[REFRESH_COOKIE])
        clear_refresh_cookie
        head :no_content
      end

      private

      def session_payload(user)
        {
          token: Sessions::JwtAuthenticator.issue(user),
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
