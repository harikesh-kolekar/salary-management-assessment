RubyLLM.configure do |config|
  config.openai_api_key = ENV["CLOUDFLARE_API_TOKEN"] if ENV["CLOUDFLARE_API_TOKEN"].present?
  account_id = ENV["CLOUDFLARE_ACCOUNT_ID"]
  config.openai_api_base = "https://api.cloudflare.com/client/v4/accounts/#{account_id}/ai/v1" if account_id.present?
  config.default_model = ENV.fetch("CLOUDFLARE_MODEL", "openai/gpt-6-luna")
  config.logger = Rails.logger
end
