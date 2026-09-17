const APP_ID = 'ourx4xix'

window.intercomSettings = {
  app_id: APP_ID
}

const existingIntercom = window.Intercom

if (typeof existingIntercom === 'function') {
  existingIntercom('reattach_activator')
  existingIntercom('update', window.intercomSettings)
} else {
  const intercom = function () {
    intercom.c(arguments)
  }

  intercom.q = []
  intercom.c = function (args) {
    intercom.q.push(args)
  }
  window.Intercom = intercom

  const loadMessenger = function () {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = `https://widget.intercom.io/widget/${APP_ID}`
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript.parentNode.insertBefore(script, firstScript)
  }

  if (document.readyState === 'complete') {
    loadMessenger()
  } else {
    window.addEventListener('load', loadMessenger, { once: true })
  }
}
