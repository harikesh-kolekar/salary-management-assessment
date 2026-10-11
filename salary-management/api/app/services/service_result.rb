class ServiceResult
  attr_reader :value

  def initialize(value:, success:)
    @value = value
    @success = success
  end

  def success?
    @success
  end
end
