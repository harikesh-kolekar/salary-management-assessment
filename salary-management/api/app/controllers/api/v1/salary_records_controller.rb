module Api
  module V1
    class SalaryRecordsController < BaseController
      def create
        visible_employees.find(params[:employee_id])
        result = SalaryRecordCreator.new(organization: current_organization, employee_scope: visible_employees, employee_id: params[:employee_id], attributes: salary_record_params).call
        if result.success?
          render json: { data: SalarySerializer.new(result.value).as_json }, status: :created
        else
          render_validation_failure(result.value)
        end
      end

      private

      def salary_record_params
        params.require(:salary_record).permit(:amount, :currency, :effective_from, :reason)
      end
    end
  end
end
