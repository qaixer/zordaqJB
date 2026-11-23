export const JOB_STATUSES = ['Baru', 'Diagnos', 'Tunggu Parts', 'Sedang Repair', 'Siap', 'Collected']

export function normalizePlateNo(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function newJobCardDraft(staffId = '') {
  return {
    plate_no: '',
    car_model: '',
    customer_complaint: '',
    check_in_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    status: 'Baru',
    notes: '',
    assigned_staff: staffId,
    job_items: [{ description: '', is_done: false }],
    job_parts: [],
  }
}

export function compressImage(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('Image could not be processed.'))
      }, 'image/jpeg', 0.82)
    }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image.')) }
    image.src = url
  })
}

