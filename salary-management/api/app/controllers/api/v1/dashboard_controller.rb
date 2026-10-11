module Api
  module V1
    class DashboardController < BaseController
      def show
        render json: DashboardSummary.new.call
      end
    end
  end
end
