class Employee < ApplicationRecord
  has_many :salary_records, -> { order(effective_from: :desc) }, dependent: :restrict_with_error

  STATUSES = %w[active leave terminated].freeze
  COUNTRY_CODES = %w[US GB IN DE CA AU SG JP].freeze
  DEPARTMENTS = %w[Engineering Finance People Sales Operations Legal Marketing Product Support].freeze

  validates :employee_number, :first_name, :last_name, :email, :country_code, :department, :job_title, :hired_on, presence: true
  validates :employee_number, :email, uniqueness: true
  validates :country_code, inclusion: { in: COUNTRY_CODES }
  validates :department, inclusion: { in: DEPARTMENTS }
  validates :email, format: { with: /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/ }
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
  scope :on_roster, -> { where(status: %w[active leave]) }

  def current_salary_record(on: Date.current)
    salary_records.where(effective_from: ..on).first
  end
end
