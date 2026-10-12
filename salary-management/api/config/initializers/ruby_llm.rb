RubyLLM.configure do |config|
  config.gemini_api_key = ENV["GEMINI_API_KEY"] if ENV["GEMINI_API_KEY"].present?
  config.default_model = ENV.fetch("GEMINI_MODEL", "gemini-3.8-flash")
  config.logger = Rails.logger
end
