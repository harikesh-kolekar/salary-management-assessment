module Api
  module V1
    class DashboardController < BaseController
      def show
        render json: DashboardSummary.new(organization: current_organization).call
      end
    end
  end
end
