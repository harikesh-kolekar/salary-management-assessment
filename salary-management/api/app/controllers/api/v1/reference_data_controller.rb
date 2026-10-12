module Api
  module V1
    class ReferenceDataController < BaseController
      def show
        render json: {
          countries: Country.order(:name).pluck(:code, :name).map { |code, name| { code:, name: } },
          departments: current_organization.departments.includes(:hr_manager).order(:name).map do |department|
            { code: department.code, name: department.name, hr_manager: { id: department.hr_manager.id, full_name: department.hr_manager.full_name } }
          end
        }
      end
    end
  end
end
