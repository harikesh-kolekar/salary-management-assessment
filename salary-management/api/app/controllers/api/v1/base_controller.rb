module Api
  module V1
    class BaseController < ApplicationController
      REFRESH_COOKIE = "salary_refresh_token".freeze
      REFRESH_COOKIE_PATH = "/api/v1/session".freeze

      before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "Not found" }, status: :not_found
      end

      private

      attr_reader :current_user

      def current_organization
        @current_organization ||= current_user.organization
      end

      def visible_employees
        @visible_employees ||= begin
          employees = current_organization.employees
          if current_user.hr_manager?
            employees.where(department_id: current_user.managed_departments.select(:id))
          else
            employees
          end
        end
      end

      def visible_departments
        @visible_departments ||= if current_user.admin?
          current_organization.departments
        else
          current_user.managed_departments.where(organization_id: current_organization.id)
        end
      end

      def require_admin!
        head :forbidden unless current_user.admin?
      end

      def set_refresh_cookie(token)
        cookies[REFRESH_COOKIE] = {
          value: token,
          httponly: true,
          secure: Rails.env.production?,
          same_site: :lax,
          path: REFRESH_COOKIE_PATH,
          expires: Sessions::RefreshTokenManager::LIFETIME.from_now
        }
      end

      def clear_refresh_cookie
        cookies.delete(REFRESH_COOKIE, path: REFRESH_COOKIE_PATH, secure: Rails.env.production?, same_site: :lax)
      end

      def authenticate_user!
        token = request.get_header("HTTP_AUTHORIZATION").to_s.match(/\ABearer (.+)\z/i)&.captures&.first
        @current_user = Sessions::JwtAuthenticator.authenticate(token) if token.present?
        render json: { error: "Authentication required" }, status: :unauthorized unless @current_user
      end

      def render_validation_failure(record)
        render json: { error: "Validation failed", details: record.errors.to_hash }, status: :unprocessable_entity
      end
    end
  end
end
