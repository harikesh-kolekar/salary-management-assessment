module Api
  module V1
    class EmployeesController < BaseController
      SORT_COLUMNS = %w[employee_number first_name last_name country_code department job_title status hired_on].freeze

      def index
        employees = Employee.all
        employees = employees.where(status: params[:status]) if Employee::STATUSES.include?(params[:status])
        employees = employees.where(country_code: params[:country].upcase) if params[:country].is_a?(String) && params[:country].present?
        employees = employees.where(department: params[:department]) if params[:department].is_a?(String) && params[:department].present?
        if params[:q].is_a?(String) && params[:q].present?
          term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].strip)}%"
          employees = employees.where("employee_number LIKE :term OR first_name LIKE :term OR last_name LIKE :term OR email LIKE :term", term: term)
        end

        total = employees.count
        sort = SORT_COLUMNS.include?(params[:sort]) ? params[:sort] : "last_name"
        direction = params[:direction] == "asc" ? :asc : :desc
        requested_page = Integer(params[:page], exception: false) || 1
        requested_size = Integer(params[:per_page], exception: false) || 25
        per_page = [[requested_size, 1].max, 100].min
        total_pages = (total.to_f / per_page).ceil
        page = [[requested_page, 1].max, [total_pages, 1].max].min
        records = employees.order(sort => direction, id: :asc).limit(per_page).offset((page - 1) * per_page).to_a
        salaries = current_salaries_for(records.map(&:id))

        render json: {
          data: records.map { |employee| employee_json(employee, salary_record: salaries[employee.id]) },
          meta: { page: page, per_page: per_page, total: total, total_pages: (total.to_f / per_page).ceil }
        }
      end

      def show
        employee = Employee.find(params[:id])
        render json: { data: employee_json(employee, salary_record: employee.current_salary_record, include_history: true) }
      end

      def create
        employee = Employee.new(employee_params)
        if employee.save
          render json: { data: employee_json(employee, include_history: true) }, status: :created
        else
          render json: { error: "Validation failed", details: employee.errors.to_hash }, status: :unprocessable_entity
        end
      end

      def update
        employee = Employee.find(params[:id])
        if employee.update(employee_params)
          render json: { data: employee_json(employee, salary_record: employee.current_salary_record, include_history: true) }
        else
          render json: { error: "Validation failed", details: employee.errors.to_hash }, status: :unprocessable_entity
        end
      end

      private

      def employee_params
        params.require(:employee).permit(:employee_number, :first_name, :last_name, :email, :country_code, :department, :job_title, :status, :hired_on)
      end

      def current_salaries_for(employee_ids)
        return {} if employee_ids.empty?
        SalaryRecord.effective_on(Date.current).where(employee_id: employee_ids)
          .order(effective_from: :desc, id: :desc).index_by(&:employee_id)
      end
    end
  end
end
