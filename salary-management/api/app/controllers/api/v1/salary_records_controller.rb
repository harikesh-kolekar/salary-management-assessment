module Api
  module V1
    class SalaryRecordsController < BaseController
      def create
        employee = Employee.find(params[:employee_id])
        record = employee.salary_records.build(salary_record_params)
        if record.save
          render json: { data: salary_json(record) }, status: :created
        else
          render json: { error: "Validation failed", details: record.errors.to_hash }, status: :unprocessable_entity
        end
      end

      private

      def salary_record_params
        params.require(:salary_record).permit(:amount, :currency, :effective_from, :reason)
      end
    end
  end
end
