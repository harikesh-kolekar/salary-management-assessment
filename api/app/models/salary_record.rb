class SalaryRecord < ApplicationRecord
  CURRENCIES = %w[USD GBP INR EUR CAD AUD SGD JPY].freeze

  belongs_to :employee

  validates :amount, numericality: { greater_than: 0 }
  validates :currency, inclusion: { in: CURRENCIES }
  validates :effective_from, :reason, presence: true
  validates :reason, length: { maximum: 240 }
  validates :effective_from, uniqueness: { scope: :employee_id }
  validate :effective_date_must_be_after_existing_records, on: :create

  scope :effective_on, ->(date) {
    where("salary_records.effective_from = (SELECT MAX(sr.effective_from) FROM salary_records sr WHERE sr.employee_id = salary_records.employee_id AND sr.effective_from <= ?)", date)
  }

  private

  def effective_date_must_be_after_existing_records
    return unless employee && effective_from
    return unless employee.salary_records.where("effective_from >= ?", effective_from).exists?

    errors.add(:effective_from, "must be later than existing salary changes")
  end
end
