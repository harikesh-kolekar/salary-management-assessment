Rails.application.routes.draw do
  root to: redirect("/index.html")
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
  namespace :api do
    namespace :v1 do
      resource :session, only: %i[create show], controller: :sessions
      resources :organizations, only: :create
      get "dashboard", to: "dashboard#show"
      resources :employees, only: %i[index show create update] do
        resources :salary_records, only: :create
      end
    end
  end
end
