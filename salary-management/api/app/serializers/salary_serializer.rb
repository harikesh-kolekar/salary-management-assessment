class SalarySerializer
  def initialize(record)
    @record = record
  end

  def as_json(*_args)
    return nil unless @record

    {
      id: @record.id,
      amount: @record.amount.to_f,
      currency: @record.currency,
      effective_from: @record.effective_from,
      reason: @record.reason
    }
  end
end
