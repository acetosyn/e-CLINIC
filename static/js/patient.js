// ============================================================
// PATIENT REGISTRATION MODULE
// Handles modal interactions, form validation, cart management,
// and preview functionality for the New Patient Registration form
// ============================================================

class PatientRegistrationModule {
  constructor() {
    this.cart = []
    this.serviceCount = 1
    this.patientData = {}
    this.referralsList = [
      "Alawo Citadel",
      "Dr Hayat",
      "Asokoro General Hospital",
      "Brain & Spine",
      "Bukola Alabi Olusola",
      "C.S.M",
      "Cecilia Nwankwo",
      "Darlington Emperor",
      "Defence",
      "Dr Dike",
      "Dr Bello",
      "Dr Bona",
      "Dr David Uzochukwu",
      "Dr Essiet Wellington",
      "Dr Folake",
      "Dr Hans",
      "Dr Hassan Garba",
      "Dr Ifeanyi",
      "Dr Jethro",
      "Dr John",
      "Dr Ogbe",
      "Dr Philip",
      "FMC Jabi",
      "FMC Keffi",
    ]

    this.init()
  }

  init() {
    this.setupModalListeners()
    this.setupFormListeners()
    this.setupServiceListeners()
    this.setupReferralListeners()
    console.log("[v0] Patient Registration Module initialized")
  }

  // ===== MODAL MANAGEMENT =====
  setupModalListeners() {
    // Open modal from action cards
    document.querySelectorAll("[data-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const modalId = el.getAttribute("data-modal")
        this.openModal(modalId)
      })
    })

    // Close modal buttons
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const modalId = el.getAttribute("data-close-modal")
        this.closeModal(modalId)
      })
    })

    // Close modal on overlay click
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id)
        }
      })
    })
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId)
    if (!modal) return

    modal.classList.add("active")
    modal.setAttribute("aria-hidden", "false")
    document.body.style.overflow = "hidden"

    // Auto-focus first input if it's the new patient modal
    if (modalId === "modalNewPatient") {
      setTimeout(() => {
        const firstInput = modal.querySelector("input[autofocus]")
        if (firstInput) firstInput.focus()
      }, 100)
    }

    console.log("[v0] Modal opened:", modalId)
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId)
    if (!modal) return

    modal.classList.remove("active")
    modal.setAttribute("aria-hidden", "true")
    document.body.style.overflow = ""
    console.log("[v0] Modal closed:", modalId)
  }

  // ===== FORM LISTENERS =====
  setupFormListeners() {
    const dobInput = document.getElementById("patient-dob")
    if (dobInput) {
      dobInput.addEventListener("change", () => this.calculateAge())
    }

    const submitBtn = document.getElementById("btn-submit-patient")
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("[v0] Submit button event listener triggered")
        this.submitPatient()
      })
      console.log("[v0] Submit button listener attached")
    } else {
      console.warn("[v0] Submit button (btn-submit-patient) not found")
    }

    const saveDraftBtn = document.getElementById("btn-save-draft")
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener("click", () => this.saveDraft())
    }

    // Service search filter
    const searchInput = document.getElementById("service-search")
    if (searchInput) {
      searchInput.addEventListener("input", (e) => this.filterServices(e.target.value))
    }
  }

  calculateAge() {
    const dobInput = document.getElementById("patient-dob")
    const ageInput = document.getElementById("patient-age")
    const ageBadge = document.getElementById("age-category-badge")

    if (!dobInput.value) {
      ageInput.value = ""
      ageBadge.textContent = ""
      return
    }

    const dob = new Date(dobInput.value)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    ageInput.value = age

    // Determine age category
    let category = ""
    let bgColor = ""
    if (age >= 1 && age <= 12) {
      category = "Child"
      bgColor = "#fef08a"
    } else if (age >= 13 && age <= 17) {
      category = "Teenage"
      bgColor = "#dbeafe"
    } else if (age >= 18) {
      category = "Adult"
      bgColor = "#dcfce7"
    }

    ageBadge.textContent = category
    ageBadge.style.background = bgColor

    console.log("[v0] Age calculated:", age, "Category:", category)
  }

  // ===== SERVICE MANAGEMENT =====
  setupServiceListeners() {
    const addServiceBtn = document.getElementById("btn-add-service")
    if (addServiceBtn) {
      addServiceBtn.addEventListener("click", () => this.addServiceRow())
    }
  }

  addServiceRow() {
    this.serviceCount++
    const container = document.getElementById("additional-services-container")

    const serviceHtml = `
      <div class="service-item" data-service-id="${this.serviceCount}">
        <div class="service-header">
          <h4>Service ${this.serviceCount}</h4>
          <button type="button" class="btn btn-outline btn-sm btn-remove-service" data-service="${this.serviceCount}">
            <i class="fa-solid fa-trash"></i> Remove
          </button>
        </div>

        <div class="form-group">
          <label for="service-type-${this.serviceCount}" class="form-label">Service Type</label>
          <select id="service-type-${this.serviceCount}" class="form-control service-dropdown">
            <option value="">-- Select Service --</option>
            <option value="General Consultation">General Consultation</option>
            <option value="Follow-up Consultation">Follow-up Consultation</option>
            <option value="Laboratory">Laboratory</option>
            <option value="Radiology">Radiology</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="Home Service">Home Service</option>
            <option value="Sickle Cell">Sickle Cell</option>
            <option value="Specialist - Medicine">Specialist - Medicine</option>
            <option value="Specialist - Surgery">Specialist - Surgery</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Venue</label>
            <div class="form-checkbox-group">
              <label class="checkbox-option">
                <input type="radio" name="service-venue-${this.serviceCount}" value="Walk-In">
                <span>Walk-In</span>
              </label>
              <label class="checkbox-option">
                <input type="radio" name="service-venue-${this.serviceCount}" value="Hospital">
                <span>Hospital</span>
              </label>
              <label class="checkbox-option">
                <input type="radio" name="service-venue-${this.serviceCount}" value="Outsourced">
                <span>Outsourced</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="result-delivery-${this.serviceCount}" class="form-label">Result Delivery</label>
            <select id="result-delivery-${this.serviceCount}" class="form-control">
              <option value="">-- Select Delivery --</option>
              <option value="Email">Email</option>
              <option value="WhatsApp/Telegram">WhatsApp/Telegram</option>
              <option value="Dispatch">Dispatch</option>
              <option value="Pickup">Pickup</option>
            </select>
          </div>
        </div>
      </div>
    `

    container.insertAdjacentHTML("beforeend", serviceHtml)

    // Add remove listener
    const removeBtn = container.querySelector(`[data-service="${this.serviceCount}"]`)
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.target.closest(".service-item").remove()
        console.log("[v0] Service row removed:", this.serviceCount)
      })
    }

    console.log("[v0] New service row added:", this.serviceCount)
  }

  filterServices(searchTerm) {
    const term = searchTerm.toLowerCase()
    const services = [
      "General Consultation",
      "Follow-up Consultation",
      "Laboratory",
      "Radiology",
      "Pharmacy",
      "Home Service",
      "Sickle Cell",
      "Specialist - Medicine",
      "Specialist - Surgery",
    ]

    document.querySelectorAll(".service-dropdown option").forEach((option) => {
      if (option.value === "") return
      const visible = option.value.toLowerCase().includes(term)
      option.style.display = visible ? "" : "none"
    })

    console.log("[v0] Services filtered:", term)
  }

  // ===== REFERRAL MANAGEMENT =====
  setupReferralListeners() {
    const addReferralBtn = document.getElementById("btn-add-referral")
    if (addReferralBtn) {
      addReferralBtn.addEventListener("click", () => {
        this.openModal("modalAddReferral")
      })
    }

    const confirmReferralBtn = document.getElementById("btn-confirm-referral")
    if (confirmReferralBtn) {
      confirmReferralBtn.addEventListener("click", () => this.addNewReferral())
    }
  }

  addNewReferral() {
    const nameInput = document.getElementById("referral-name")
    const typeInput = document.getElementById("referral-type")
    const name = nameInput.value.trim()

    if (!name) {
      alert("Please enter referral name")
      return
    }

    // Add to referral list
    if (!this.referralsList.includes(name)) {
      this.referralsList.push(name)
      console.log("[v0] New referral added:", name)
    }

    // Update dropdown
    const select = document.getElementById("patient-referred-by")
    const option = document.createElement("option")
    option.value = name
    option.textContent = name
    select.appendChild(option)
    select.value = name

    // Reset form and close modal
    document.getElementById("referral-form").reset()
    this.closeModal("modalAddReferral")

    console.log("[v0] Referral confirmed and selected:", name)
  }

  // ===== FORM SUBMISSION =====
  submitPatient() {
    console.log("[v0] Submit button clicked")
    const form = document.getElementById("patient-registration-form")

    if (!form) {
      console.error("[v0] Patient registration form not found")
      alert("Error: Patient registration form not found. Please refresh the page.")
      return
    }

    if (!form.checkValidity()) {
      alert("Please fill all required fields")
      form.reportValidity()
      return
    }

    try {
      // Get sex value safely
      const sexRadio = document.querySelector('input[name="patient-sex"]:checked')
      const sexValue = sexRadio ? sexRadio.value : ''
      
      if (!sexValue) {
        alert("Please select a gender/sex")
        return
      }

      // Collect services first (might throw error)
      let services = []
      try {
        services = this.collectServices()
      } catch (serviceError) {
        console.warn("[v0] Error collecting services:", serviceError)
        // Continue without services if collection fails
      }

      this.patientData = {
        title: document.getElementById("patient-title")?.value || '',
        firstName: document.getElementById("patient-first-name")?.value || '',
        lastName: document.getElementById("patient-last-name")?.value || '',
        dob: document.getElementById("patient-dob")?.value || '',
        age: document.getElementById("patient-age")?.value || '',
        sex: sexValue,
        occupation: document.getElementById("patient-occupation")?.value || '',
        referredBy: document.getElementById("patient-referred-by")?.value || '',
        phone: document.getElementById("patient-phone")?.value || '',
        email: document.getElementById("patient-email")?.value || '',
        address: document.getElementById("patient-address")?.value || '',
        services: services,
      }

      console.log("[v0] Patient data collected:", this.patientData)

      // Validate required fields
      if (!this.patientData.firstName || !this.patientData.lastName || !this.patientData.dob || !this.patientData.sex || !this.patientData.phone) {
        alert("Please fill all required fields: First Name, Last Name, Date of Birth, Sex, and Phone")
        return
      }

      // Show preview modal
      this.showPreview()
    } catch (error) {
      console.error("[v0] Error collecting patient data:", error)
      console.error("[v0] Error stack:", error.stack)
      alert(`Error: ${error.message || 'An error occurred while collecting form data. Please check the browser console for details.'}`)
    }
  }

  collectServices() {
    const services = []
    try {
      document.querySelectorAll(".service-item").forEach((item) => {
        const id = item.getAttribute("data-service-id")
        if (!id) return
        
        const serviceTypeEl = document.getElementById(`service-type-${id}`)
        if (!serviceTypeEl) return
        
        const serviceType = serviceTypeEl.value
        if (!serviceType) return

        const venueRadio = document.querySelector(`input[name="service-venue-${id}"]:checked`)
        const venue = venueRadio ? venueRadio.value : "Not specified"
        
        const deliveryEl = document.getElementById(`result-delivery-${id}`)
        const delivery = deliveryEl ? deliveryEl.value : "Not specified"

        services.push({
          type: serviceType,
          venue: venue || "Not specified",
          delivery: delivery || "Not specified",
        })
      })
    } catch (error) {
      console.warn("[v0] Error in collectServices:", error)
      // Return empty array if there's an error
    }

    return services
  }

  saveDraft() {
    const formData = {
      title: document.getElementById("patient-title").value,
      firstName: document.getElementById("patient-first-name").value,
      lastName: document.getElementById("patient-last-name").value,
      dob: document.getElementById("patient-dob").value,
      occupation: document.getElementById("patient-occupation").value,
      referredBy: document.getElementById("patient-referred-by").value,
      phone: document.getElementById("patient-phone").value,
      email: document.getElementById("patient-email").value,
      address: document.getElementById("patient-address").value,
      sex: document.querySelector('input[name="patient-sex"]:checked')?.value,
    }

    localStorage.setItem("patientDraft", JSON.stringify(formData))
    alert("Draft saved successfully! You can continue later.")
    console.log("[v0] Patient draft saved to localStorage")
  }

  // ===== PREVIEW MODAL =====
  showPreview() {
    const previewContent = document.getElementById("preview-content")

    const previewHtml = `
      <div class="preview-section">
        <h3 class="preview-section-title">Personal Information</h3>
        <div class="preview-item">
          <span class="preview-item-label">Name:</span>
          <span class="preview-item-value">${this.patientData.title} ${this.patientData.firstName} ${this.patientData.lastName}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Date of Birth:</span>
          <span class="preview-item-value">${this.patientData.dob}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Age:</span>
          <span class="preview-item-value">${this.patientData.age}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Sex:</span>
          <span class="preview-item-value">${this.patientData.sex}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Occupation:</span>
          <span class="preview-item-value">${this.patientData.occupation || "Not specified"}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Referred By:</span>
          <span class="preview-item-value">${this.patientData.referredBy}</span>
        </div>
      </div>

      <div class="preview-section">
        <h3 class="preview-section-title">Contact Information</h3>
        <div class="preview-item">
          <span class="preview-item-label">Phone:</span>
          <span class="preview-item-value">${this.patientData.phone}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Email:</span>
          <span class="preview-item-value">${this.patientData.email}</span>
        </div>
        <div class="preview-item">
          <span class="preview-item-label">Address:</span>
          <span class="preview-item-value">${this.patientData.address}</span>
        </div>
      </div>

      <div class="preview-section">
        <h3 class="preview-section-title">Selected Services</h3>
        ${this.patientData.services
          .map(
            (service, idx) => `
          <div class="preview-item">
            <span class="preview-item-label">Service ${idx + 1}:</span>
            <span class="preview-item-value">
              ${service.type} (${service.venue}, ${service.delivery})
            </span>
          </div>
        `,
          )
          .join("")}
      </div>
    `

    previewContent.innerHTML = previewHtml

    // Setup preview button listeners
    const editBtn = document.getElementById("btn-preview-edit")
    const confirmBtn = document.getElementById("btn-preview-confirm")

    editBtn.onclick = () => {
      this.closeModal("modalPreviewPatient")
      this.openModal("modalNewPatient")
    }

    confirmBtn.onclick = () => {
      this.confirmRegistration()
    }

    this.closeModal("modalNewPatient")
    this.openModal("modalPreviewPatient")

    console.log("[v0] Preview modal displayed")
  }

  async confirmRegistration() {
    console.log("[v0] Patient registration confirmed:", this.patientData)

    try {
      // Prepare data for API
      const apiData = {
        title: this.patientData.title,
        first_name: this.patientData.firstName,
        last_name: this.patientData.lastName,
        date_of_birth: this.patientData.dob,
        age: parseInt(this.patientData.age) || null,
        sex: this.patientData.sex,
        occupation: this.patientData.occupation || null,
        phone: this.patientData.phone,
        email: this.patientData.email || null,
        address: this.patientData.address || null,
        referred_by: this.patientData.referredBy || null,
        services: this.patientData.services || []
      }

      // Submit to backend
      const response = await fetch('/api/patients/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      })

      const result = await response.json()

      if (result.success) {
        // Save patient name before clearing data
        const patientName = `${this.patientData.firstName} ${this.patientData.lastName}`
        const patientId = result.patient.patient_id
        const fileNo = result.patient.file_no
        
        // Close modal immediately before showing alert
        this.closeModal("modalPreviewPatient")
        
        // Reset form
        const form = document.getElementById("patient-registration-form")
        if (form) {
          form.reset()
        }
        this.serviceCount = 1
        this.patientData = {}

        // Show success message (after modal is closed)
        alert(
          `✓ Patient "${patientName}" registered successfully!\n\nPatient ID: ${patientId}\nFile No: ${fileNo}`
        )

        // Refresh page or update stats
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        // Close modal even on error
        this.closeModal("modalPreviewPatient")
        alert(`Error: ${result.message || 'Failed to register patient'}`)
      }
    } catch (error) {
      console.error("Registration error:", error)
      // Close modal on error too
      this.closeModal("modalPreviewPatient")
      alert("An error occurred while registering the patient. Please try again.")
    }

    console.log("[v0] Registration completed and form reset")
  }
}

// Initialize module when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PatientRegistrationModule()
})
