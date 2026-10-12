module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "Not found" }, status: :not_found
      end

      private

      attr_reader :current_user

      def current_organization
        current_user.organization
      end

      def visible_employees
        employees = current_organization.employees
        employees = employees.where(department_id: current_user.managed_departments.select(:id)) if current_user.hr_manager?
        employees
      end

      def visible_departments
        current_user.admin? ? current_organization.departments : current_user.managed_departments.where(organization_id: current_organization.id)
      end

      def require_admin!
        head :forbidden unless current_user.admin?
      end

      def authenticate_user!
        token = request.get_header("HTTP_AUTHORIZATION").to_s.match(/\ABearer (.+)\z/i)&.captures&.first
        @current_user = SessionToken.authenticate(token) if token.present?
        render json: { error: "Authentication required" }, status: :unauthorized unless @current_user
      end

      def render_validation_failure(record)
        render json: { error: "Validation failed", details: record.errors.to_hash }, status: :unprocessable_entity
      end

    end
  end
end
