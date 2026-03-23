handlebars -m js/templates/ > js/templates/templates.js
uglifyjs js/templates/templates.js -o js/templates/templates.min.js