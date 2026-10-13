module Api
  module V1
    class AssistantController < BaseController
      def ask
        question = params.require(:question).to_s.strip
        return render json: { error: "Enter a question about employees or compensation." }, status: :unprocessable_entity if question.blank?
        return render json: { error: "Keep questions under 500 characters." }, status: :unprocessable_entity if question.length > 500
        result = Reports::PayrollAssistant.new(employee_scope: visible_employees, page: requested_page).call(question)
        render json: result
      rescue Reports::PayrollAssistant::MissingProviderConfig
        render json: { error: "The payroll assistant is not configured yet. Set OPENAI_API_KEY in the server environment." }, status: :service_unavailable
      rescue ActionController::ParameterMissing
        render json: { error: "A question is required." }, status: :unprocessable_entity
      rescue StandardError => error
        Rails.logger.warn("Payroll assistant failed: #{error.class}")
        render json: { error: "The assistant could not complete that report. Please try again." }, status: :bad_gateway
      end

      private

      def requested_page
        [[Integer(params[:page], exception: false) || 1, 1].max, 10_000].min
      end
    end
  end
end
