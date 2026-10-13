RubyLLM.configure do |config|
  config.openai_api_key = ENV["OPENAI_API_KEY"] if ENV["OPENAI_API_KEY"].present?
  config.default_model = ENV.fetch("OPENAI_MODEL", "gpt-6-luna")
  config.logger = Rails.logger
end
