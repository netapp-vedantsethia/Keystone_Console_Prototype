(function () {
  'use strict';

  function getById(id) {
    return document.getElementById(id);
  }

  function init() {
    var form = getById('deviation-form');
    var dropZone = getById('deviation-drop-zone');
    var fileInput = getById('deviation-files');
    var browseBtn = getById('deviation-browse');
    var dropText = getById('deviation-drop-text');
    var fileNames = getById('deviation-file-names');

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', function () {
        fileInput.click();
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', function (e) {
        if (e.target !== browseBtn) fileInput.click();
      });
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          updateFileNames();
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', updateFileNames);
    }

    function updateFileNames() {
      if (!fileNames || !fileInput || !fileInput.files) return;
      var names = [];
      for (var i = 0; i < fileInput.files.length; i++) {
        names.push(fileInput.files[i].name);
      }
      fileNames.textContent = names.length ? names.join(', ') : '';
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        alert('Deviation intake form submitted. In production this would send to your backend or Smartsheet.');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
