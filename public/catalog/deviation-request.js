(function () {
  'use strict';

  function getById(id) {
    return document.getElementById(id);
  }

  function generateRequestId() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var r = Math.floor(Math.random() * 10000);
    return 'REQ-' + y + m + d + '-' + String(r).padStart(4, '0');
  }

  function init() {
    var form = getById('deviation-request-form');
    var requestIdInput = getById('request-id');

    if (requestIdInput) {
      requestIdInput.value = generateRequestId();
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var requester = (getById('requester-name') || {}).value || '';
        var subject = (getById('requested-subject') || {}).value || '';
        var deviation = (getById('requested-deviation') || {}).value || '';
        var comment = (getById('request-comment') || {}).value || '';
        var reqId = (getById('request-id') || {}).value || '';
        if (!deviation) {
          alert('Please select a requested feature request.');
          return;
        }
        alert('Request submitted.\nRequest ID: ' + reqId + '\nFeature request: ' + (getById('requested-deviation').selectedOptions[0] ? getById('requested-deviation').selectedOptions[0].text : '') + (requester ? '\nRequester: ' + requester : '') + (subject ? '\nSubject: ' + subject : ''));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
