module Api
  module V1
    class SalaryRecordsController < BaseController
      def create
        result = SalaryRecordCreator.new(employee_id: params[:employee_id], attributes: salary_record_params).call
        if result.success?
          render json: { data: SalarySerializer.new(result.record).as_json }, status: :created
        else
          render json: { error: "Validation failed", details: result.record.errors.to_hash }, status: :unprocessable_entity
        end
      end

      private

      def salary_record_params
        params.require(:salary_record).permit(:amount, :currency, :effective_from, :reason)
      end
    end
  end
end
