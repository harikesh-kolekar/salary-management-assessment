module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "Not found" }, status: :not_found
      end

      private

      def render_validation_failure(record)
        render json: { error: "Validation failed", details: record.errors.to_hash }, status: :unprocessable_entity
      end

    end
  end
end
