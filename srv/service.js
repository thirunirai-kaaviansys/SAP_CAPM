const cds = require('@sap/cds')

module.exports = async function () {
  const bp = await cds.connect.to('BusinessPartnerA2X')

  this.on('READ', 'A_BusinessPartner', req => {
    return bp.run(req.query)
  })
}
