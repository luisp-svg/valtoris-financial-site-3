import express from 'express'

const app = express()
app.use(express.json())

app.post('/api/lead', async (req, res) => {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  if (!webhookUrl) {
    return res.status(503).json({ ok: false, error: 'Webhook not configured' })
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submittedAt: new Date().toISOString(), ...req.body })
  })

  res.status(response.ok ? 200 : 502).json({ ok: response.ok })
})

app.listen(3001)
