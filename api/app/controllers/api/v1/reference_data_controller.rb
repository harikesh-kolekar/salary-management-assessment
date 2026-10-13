module Api
  module V1
    class ReferenceDataController < BaseController
      def show
        render json: {
          countries: Country.order(:name).pluck(:code, :name).map { |code, name| { code:, name: } },
          departments: visible_departments.includes(:hr_manager).order(:name).map do |department|
            { code: department.code, name: department.name, hr_manager: { id: department.hr_manager.id, full_name: department.hr_manager.full_name } }
          end,
          hr_managers: current_organization.users.where(role: %w[admin hr_manager]).order(:full_name).map do |user|
            { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
          end
        }
      end
    end
  end
end
