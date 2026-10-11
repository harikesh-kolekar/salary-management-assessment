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
