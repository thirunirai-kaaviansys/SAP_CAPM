const cds = require('@sap/cds')
 
module.exports = async function () {
  const bp = await cds.connect.to('BusinessPartnerA2X')
 
  // Handle BusinessPartner read requests
  this.on('READ', 'A_BusinessPartner', async (req) => {
    console.log('Reading A_BusinessPartner for value help')
    try {
      const result = await bp.run(req.query)
      console.log('BusinessPartner query result:', result)
      return result
    } catch (error) {
      console.error('Error reading BusinessPartner:', error.message)
      return []
    }
  })
 
  // Handle Risk creation/update BEFORE draft save
  this.before(['NEW', 'CREATE', 'UPDATE'], 'Risks', async (req) => {
    const data = req.data
   
    // Only process if supplier_BusinessPartner is being set/changed
    if (data.supplier_BusinessPartner !== undefined) {
      console.log('Processing supplier_BusinessPartner:', data.supplier_BusinessPartner)
     
      if (data.supplier_BusinessPartner) {
        try {
          console.log('Fetching BusinessPartner data for:', data.supplier_BusinessPartner)
         
          // Fetch BusinessPartner details from external service
          const businessPartner = await bp.run(
            SELECT.one('A_BusinessPartner')
              .columns(['BusinessPartner', 'BusinessPartnerFullName', 'BusinessPartnerIsBlocked'])
              .where({ BusinessPartner: data.supplier_BusinessPartner })
          )
         
          console.log('Fetched BusinessPartner:', businessPartner)
         
          if (businessPartner) {
            // Auto-fill the fields
            data.BusinessPartnerFullName = businessPartner.BusinessPartnerFullName
            data.BusinessPartnerIsBlocked = businessPartner.BusinessPartnerIsBlocked
            console.log('Auto-filled BusinessPartner data:', {
              fullName: data.BusinessPartnerFullName,
              isBlocked: data.BusinessPartnerIsBlocked
            })
          } else {
            console.log('BusinessPartner not found:', data.supplier_BusinessPartner)
            data.BusinessPartnerFullName = null
            data.BusinessPartnerIsBlocked = null
          }
        } catch (error) {
          console.error('Error fetching BusinessPartner data:', error.message)
          data.BusinessPartnerFullName = null
          data.BusinessPartnerIsBlocked = null
        }
      } else {
        // Clear fields if supplier_BusinessPartner is cleared
        data.BusinessPartnerFullName = null
        data.BusinessPartnerIsBlocked = null
        console.log('Cleared BusinessPartner data')
      }
    }
  })
 
  // Also handle after draft is activated to ensure data is persisted
  this.after('draftActivate', 'Risks', async (req) => {
    console.log('After draftActivate for Risks')
   
    // If this is a draft activation, check if we need to ensure BusinessPartner data is saved
    if (req.data && req.data.supplier_BusinessPartner) {
      const tx = cds.transaction(req)
     
      try {
        // Check if BusinessPartner data exists on the active entity
        const activeRisk = await tx.run(
          SELECT.one.from('RiskManagement.Risks')
            .where({ ID: req.data.ID })
            .columns(['BusinessPartnerFullName', 'BusinessPartnerIsBlocked'])
        )
       
        // If BusinessPartner data is missing on active entity but we have supplier_BusinessPartner,
        // fetch and update it
        if ((!activeRisk.BusinessPartnerFullName || !activeRisk.BusinessPartnerIsBlocked !== undefined) &&
            req.data.supplier_BusinessPartner) {
         
          const businessPartner = await bp.run(
            SELECT.one('A_BusinessPartner')
              .columns(['BusinessPartnerFullName', 'BusinessPartnerIsBlocked'])
              .where({ BusinessPartner: req.data.supplier_BusinessPartner })
          )
         
          if (businessPartner) {
            await tx.run(
              UPDATE('RiskManagement.Risks')
                .set({
                  BusinessPartnerFullName: businessPartner.BusinessPartnerFullName,
                  BusinessPartnerIsBlocked: businessPartner.BusinessPartnerIsBlocked
                })
                .where({ ID: req.data.ID })
            )
            console.log('Updated BusinessPartner data after draft activation')
          }
        }
      } catch (error) {
        console.error('Error in after draftActivate:', error.message)
      }
    }
  })
} 
