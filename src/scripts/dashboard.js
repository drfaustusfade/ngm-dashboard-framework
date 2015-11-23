/*
 * The MIT License
 *
 * Copyright (c) 2015, Patrick Fitzgerald
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @ngdoc directive
 * @name ngm.directive:ngmDashboard
 * @element div
 * @restrict EA
 * @scope
 * @description
 *
 * `ngmDashboard` is a directive which renders the dashboard with all its
 * components. The directive requires a name attribute. The name of the
 * dashboard can be used to store the model.
 *
 * @param {string} name name of the dashboard. This attribute is required.
 * @param {boolean=} editable false to disable the editmode of the dashboard.
 * @param {boolean=} collapsible true to make widgets collapsible on the dashboard.
 * @param {boolean=} maximizable true to add a button for open widgets in a large modal panel.
 * @param {string=} structure the default structure of the dashboard.
 * @param {object=} ngmModel model object of the dashboard.
 * @param {function=} ngmWidgetFilter function to filter widgets on the add dialog.
 */

angular.module('ngm')
	.service('ngmData', function($q, $http){
		return {
			get: function(request){
				var deferred = $q.defer();
				$http(request)
					.success(function(data){
						deferred.resolve(data);
					})
					.error(function(){
						deferred.reject();
					});

				return deferred.promise;
			}
		};
	})
	.directive('ngmDashboard', function ($rootScope, $log, dashboard, ngmTemplatePath) {
		'use strict';

		function stringToBoolean(string){
			switch(angular.isDefined(string) ? string.toLowerCase() : null){
				case 'true': case 'yes': case '1': return true;
				case 'false': case 'no': case '0': case null: return false;
				default: return Boolean(string);
			}
		}

		function copyWidgets(source, target) {
			if ( source.widgets && source.widgets.length > 0 ){
				var w = source.widgets.shift();
				while (w){
					target.widgets.push(w);
					w = source.widgets.shift();
				}
			}
		}

		/**
		* Copy widget from old columns to the new model
		* @param object root the model
		* @param array of columns
		* @param counter
		*/
		function fillStructure(root, columns, counter) {
			counter = counter || 0;

			if (angular.isDefined(root.rows)) {
				angular.forEach(root.rows, function (row) {
					angular.forEach(row.columns, function (column) {
						// if the widgets prop doesn't exist, create a new array for it.
						// this allows ui.sortable to do it's thing without error
						if (!column.widgets) {
							column.widgets = [];
						}

						// if a column exist at the counter index, copy over the column
						if (angular.isDefined(columns[counter])) {
							// do not add widgets to a column, which uses nested rows
							if (!angular.isDefined(column.rows)){
								copyWidgets(columns[counter], column);
								counter++;
							}
						}

						// run fillStructure again for any sub rows/columns
						counter = fillStructure(column, columns, counter);
					});
				});
			}
			return counter;
		}

		/**
		* Read Columns: recursively searches an object for the 'columns' property
		* @param object model
		* @param array  an array of existing columns; used when recursion happens
		*/
		function readColumns(root, columns) {
			columns = columns || [];

			if (angular.isDefined(root.rows)) {
				angular.forEach(root.rows, function (row) {
					angular.forEach(row.columns, function (col) {
						columns.push(col);
						// keep reading columns until we can't any more
						readColumns(col, columns);
					});
				});
			}

			return columns;
		}

		function changeStructure(model, structure){
			var columns = readColumns(model);
			var counter = 0;

			model.rows = angular.copy(structure.rows);

			while ( counter < columns.length ){
				counter = fillStructure(model, columns, counter);
			}
		}

		function createConfiguration(type){
			var cfg = {};
			var config = dashboard.widgets[type].config;
			if (config){
				cfg = angular.copy(config);
			}
			return cfg;
		}

		/**
		 * Find first widget column in model.
		 *
		 * @param dashboard model
		 */
		function findFirstWidgetColumn(model){
			var column = null;
			if (!angular.isArray(model.rows)){
				$log.error('model does not have any rows');
				return null;
			}
			for (var i=0; i<model.rows.length; i++){
				var row = model.rows[i];
				if (angular.isArray(row.columns)){
					for (var j=0; j<row.columns.length; j++){
						var col = row.columns[j];
						if (!col.rows){
							column = col;
							break;
						}
					}
				}
				if (column){
					break;
				}
			}
			return column;
		}

		return {
			replace: true,
			restrict: 'EA',
			transclude : false,
			scope: {
				structure: '@',
				name: '@',
				collapsible: '@',
				editable: '@',
				maximizable: '@',
				ngmModel: '=',
				ngmWidgetFilter: '='
			},
			controller: function($scope){
				var model = {};
				var structure = {};
				var widgetFilter = null;
				var structureName = {};
				var name = $scope.name;

				// Update widget configs with broadcast
				$scope.ngmModel.updateWidgets = function(params){
					$scope.$broadcast( 'updateWidgetConfigs', params );
				}        

				// Watching for changes on ngmModel
				$scope.$watch('ngmModel', function(oldVal, newVal) {
					// has model changed or is the model attribute not set
					if (newVal !== null || (oldVal === null && newVal === null)) {
						model = $scope.ngmModel;
						widgetFilter = $scope.ngmWidgetFilter;
						if ( ! model || ! model.rows ){
							structureName = $scope.structure;
							structure = dashboard.structures[structureName];
							if (structure){
								if (model){
									model.rows = angular.copy(structure).rows;
								} else {
									model = angular.copy(structure);
								}
								model.structure = structureName;
							} else {
								$log.error( 'could not find structure ' + structureName);
							}
						}

						if (model) {
							if (!model.title){
								model.title = 'Dashboard';
							}
							if (!model.titleTemplateUrl) {
								model.titleTemplateUrl = ngmTemplatePath + 'dashboard-title.html';
							}
							$scope.model = model;
						} else {
							$log.error('could not find or create model');
						}
					}
				}, true);

				// edit mode
				$scope.editMode = false;
				$scope.editClass = '';

			},
			link: function ($scope, $element, $attr) {
				// pass options to scope
				var options = {
					name: $attr.name,
					editable: true,
					maximizable: stringToBoolean($attr.maximizable),
					collapsible: stringToBoolean($attr.collapsible)
				};
				if (angular.isDefined($attr.editable)){
					options.editable = stringToBoolean($attr.editable);
				}
				$scope.options = options;
			},
			templateUrl: ngmTemplatePath + 'dashboard.html'
		};
	})
	// toggles accordian classes for 
	.directive('ngmMenu', function() {

		return {
			
			// Restrict it to be an attribute in this case
			restrict: 'A',
			
			// responsible for registering DOM listeners as well as updating the DOM
			link: function(scope, el, attr) {

				// set initial menu style - has to be a better way?
				setTimeout(function(){

					// For all itmes
					$('.side-menu').find('li').each(function(i, d) {

						// find the row that is active
						if ($(d).attr('class').search('active') > 0) {

							// set list header
							$(d).closest('.bold').attr('class', 'bold active');
							
							// set z-depth-1
							$(d).closest('.bold').find('a').attr('class', 
									$(d).closest('.bold').find('a').attr('class') + ' z-depth-1' );

							// slide down list
							$(d).closest('.collapsible-body').slideDown();
							$(d).closest('.collapsible-body').attr('class',
								$(d).closest('.collapsible-body').attr('class') + ' active');
						}
					});

				}, 0);

				// on element click
				el.bind( 'click', function( $event ) {
					
					// toggle list 
					el.toggleClass('active');
					// toggle list 
					el.find('.collapsible-header').toggleClass('z-depth-1');

					// toggle list rows active
					el.find('.collapsible-body').toggleClass('active');

					// toggle list rows animation
					if (el.find('.collapsible-body').hasClass('active')) {
						el.find('.collapsible-body').slideDown();
					} else {
						el.find('.collapsible-body').slideUp();
					}
					
				});
			}
		};
	})
	.directive('ngmDashboardDownload',  function(dashboard, ngmData) {

		// client side download    
		var download = {
	
			// prepare and stream CSV to client      
			'csv': function(filename, request, dataKey){

				// get data
				ngmData.get(request)
					.then(function(data){

						// datatype
						var csvHeader;
						var type = 'data:text/csv;charset=utf-8';

						// convert json to array
						var rows = data[dataKey].map(function (row) {

							// csv headers
							csvHeader = [];
							var record = [];

							// access each value
							angular.forEach(row, function(d, key){

								// create flat array
								csvHeader.push(key);
								record.push(d);

							});

							// join as csv string
							var csvRow = record.join()

							// return
							return csvRow

						});

						// compile csv data
						var csvData = [];
								csvData.push(csvHeader.join());
								csvData.push(rows.join('\n'));

						// create element and add csv string
						var el = document.createElement('a');
								el.href = 'data:attachment/csv,' + encodeURIComponent(csvData);
								el.target = '_blank';
								el.download = filename + '.csv';

						// append, download & remove
						document.body.appendChild(el);
						el.click();
						el.remove();

					});
			},

			// client side PDF generation
			'pdf': function(filename, request, dataKey){
				console.log('PDF');
			},

			// writes metrics to rest api
			'setMetrics': function(request){
				ngmData.get(request)
					.then(function(data){
					});
			}

		}

		return {
			
			// element or attrbute
			restrict: 'EA',

			replace: true,

			// template: '<a class="tooltipped" data-position="top" data-delay="50" data-tooltip="{{ hover }}" style="color: {{ icon.color }}"><i class="{{ icon.size }} material-icons">{{ icon.type }}</i></a>',

			template: '<a class="tooltipped" data-position="left" data-delay="50" data-tooltip="{{ hover }}"><button style="width: 100%;" class="btn btn-large waves-effect waves-teal" type="submit">Download CSV</button>',

			scope: {
				icon: '=',
				type: '=',
				hover: '=',
				dataKey: '=',
				filename: '=',
				request: '=',
				metrics: '='
			},

			// onclick
			link: function(scope, el, attr) {

				// init tooltip
				$('.tooltipped').tooltip({
					tooltip: 'Download CSV'
				});

				// set defaults
				scope.icon = {
					type: scope.icon && scope.icon.type ? scope.icon.type : 'ic_assignment_returned',
					color: scope.icon && scope.icon.color ? scope.icon.color : '',
					size: scope.icon && scope.icon.size ? scope.icon.size : 'small'
				}
				scope.type = scope.type ? scope.type : 'csv';
				scope.hover = scope.hover ? scope.hover : 'Download ' + scope.type;
				scope.dataKey = scope.dataKey ? scope.dataKey : 'data';
				scope.filename = scope.filename ? scope.filename : moment().format();        
				
				// bind download event
				el.bind( 'click', function($e) {

					// prepare download
					download[scope.type](scope.filename, scope.request, scope.dataKey);

					// record metrics
					if (scope.metrics) {
						download.setMetrics(scope.metrics);
					}

				});

			}
		}
	})
	.directive("ngModel", ["$timeout", function($timeout){
			return {
					restrict: 'A',
					priority: -1, // lower priority than built-in ng-model so it runs first
					link: function(scope, element, attr) {
							scope.$watch(attr.ngModel,function(value){
									$timeout(function () {
											if (value){
													element.trigger("change");
											} else if(element.attr('placeholder') === undefined) {
													if(!element.is(":focus"))
															element.trigger("blur");
											}
									});
							});
					}
			};
	}])
	/**
	 * Add pickadate directive
	 * Type text is mandatory
	 * Example:
	 <input input-date
			type="text"
			name="created"
			id="inputCreated"
			ng-model="currentTime"
			format="dd/mm/yyyy"
			months-full="{{ monthFr }}"
			months-short="{{ monthShortFr }}"
			weekdays-full="{{ weekdaysFullFr }}"
			weekdays-short="{{ weekdaysShortFr }}"
			weekdays-letter="{{ weekdaysLetterFr }}"
			disable="disable"
			today="today"
			clear="clear"
			close="close"
			on-start="onStart()"
			on-render="onRender()"
			on-open="onOpen()"
			on-close="onClose()"
			on-set="onSet()"
			on-stop="onStop()" />
	 */
	 // source
	 // https://github.com/krescruz/angular-materialize/
  .directive('ngmDate', ["$compile", "$timeout", function ($compile, $timeout) {

    // Define Prototype Date format
    // Use like this
    // today = new Date();
    // var dateString = today.format("dd-m-yy");
    var dateFormat = function () {

        var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
            timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
            timezoneClip = /[^-+\dA-Z]/g,
            pad = function (val, len) {
                val = String(val);
                len = len || 2;
                while (val.length < len) {
                    val = "0" + val;
                }
                return val;
            };

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc) {

            var dF = dateFormat;

            // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
            if (arguments.length === 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            // Passing date through Date applies Date.parse, if necessary
            date = date ? new Date(date) : new Date();
            if (isNaN(date)) throw SyntaxError("invalid date");

            mask = String(dF.masks[mask] || mask || dF.masks["default"]);

            // Allow setting the utc argument via the mask
            if (mask.slice(0, 4) == "UTC:") {
                mask = mask.slice(4);
                utc = true;
            }

            var _ = utc ? "getUTC" : "get",
                d = date[ _ + "Date" ](),
                D = date[ _ + "Day" ](),
                m = date[ _ + "Month" ](),
                y = date[ _ + "FullYear" ](),
                H = date[ _ + "Hours" ](),
                M = date[ _ + "Minutes" ](),
                s = date[ _ + "Seconds" ](),
                L = date[ _ + "Milliseconds" ](),
                o = utc ? 0 : date.getTimezoneOffset(),
                flags = {
                    d:    d,
                    dd:   pad(d),
                    ddd:  dF.i18n.dayNames[D],
                    dddd: dF.i18n.dayNames[D + 7],
                    m:    m + 1,
                    mm:   pad(m + 1),
                    mmm:  dF.i18n.monthNames[m],
                    mmmm: dF.i18n.monthNames[m + 12],
                    yy:   String(y).slice(2),
                    yyyy: y,
                    h:    H % 12 || 12,
                    hh:   pad(H % 12 || 12),
                    H:    H,
                    HH:   pad(H),
                    M:    M,
                    MM:   pad(M),
                    s:    s,
                    ss:   pad(s),
                    l:    pad(L, 3),
                    L:    pad(L > 99 ? Math.round(L / 10) : L),
                    t:    H < 12 ? "a"  : "p",
                    tt:   H < 12 ? "am" : "pm",
                    T:    H < 12 ? "A"  : "P",
                    TT:   H < 12 ? "AM" : "PM",
                    Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
                    o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                    S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
                };

            return mask.replace(token, function ($0) {
                return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
            });
        };
    }();

    // Some common format strings
    dateFormat.masks = {
       "default":      "ddd mmm dd yyyy HH:MM:ss",
        shortDate:      "m/d/yy",
        mediumDate:     "mmm d, yyyy",
        longDate:       "mmmm d, yyyy",
        fullDate:       "dddd, mmmm d, yyyy",
        shortTime:      "h:MM TT",
        mediumTime:     "h:MM:ss TT",
        longTime:       "h:MM:ss TT Z",
        isoDate:        "yyyy-mm-dd",
        isoTime:        "HH:MM:ss",
        isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
        isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
    };

    // Internationalization strings
    dateFormat.i18n = {
        dayNames: [
            "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
            "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
        ],
        monthNames: [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
        ]
    };

    // For convenience...
    Date.prototype.format = function (mask, utc) {
        return dateFormat(this, mask, utc);
    };

    /**
     * Validate date object
     * @param  {Date}  date
     * @return {Boolean}
     */
    var isValidDate = function(date) {
        if( Object.prototype.toString.call(date) === '[object Date]' ) {
            return !isNaN(date.getTime());
        } 
        return false;
    };    

    return {
      require: 'ngModel',
      scope: {
          container: "@",
          format: "@",
          formatSubmit: "@",
          monthsFull: "@",
          monthsShort: "@",
          weekdaysFull: "@",
          weekdaysLetter: "@",
          firstDay: "=",
          disable: "=",
          today: "=",
          clear: "=",
          close: "=",
          selectYears: "=",
          onStart: "&",
          onRender: "&",
          onOpen: "&",
          onClose: "&",
          onSet: "&",
          onStop: "&",
          ngReadonly: "=?",
          max: "@",
          min: "@"
      },
      link: function ($scope, element, attrs, ngModelCtrl) {

        ngModelCtrl.$formatters.unshift(function (modelValue) {
          if (modelValue) {
            var date = new Date(modelValue);
            return (angular.isDefined($scope.format)) ? date.format($scope.format) : date.format('d mmmm, yyyy');
          }
          return null;
        });      

        var pickadateInput = element.pickadate({
          selectMonths: true, // Creates a dropdown to control month
          selectYears: 15, // Creates a dropdown of 15 years to control year
          min: (angular.isDefined($scope.min)) ? $scope.min : undefined,
					max: (angular.isDefined($scope.max)) ? $scope.max : undefined,
          onStart: function(){
            setTimeout(function(){
              // set time
              var date = ngModelCtrl.$viewValue;
              picker.set('select', [new Date(date).getFullYear(), new Date(date).getMonth(), new Date(date).getDate()])
            }, 0)
          },
          onRender: function(){
            //
          },          
          onSet: function(event){
            // close on date select
            if(event.select){
              picker.close();
            }

          }

            // container : (angular.isDefined(scope.container)) ? scope.container : 'body',
            // format: (angular.isDefined(scope.format)) ? scope.format : undefined,
            // formatSubmit: (angular.isDefined(scope.formatSubmit)) ? scope.formatSubmit : undefined,
            // monthsFull: (angular.isDefined(monthsFull)) ? monthsFull : undefined,
            // monthsShort: (angular.isDefined(monthsShort)) ? monthsShort : undefined,
            // weekdaysFull: (angular.isDefined(weekdaysFull)) ? weekdaysFull : undefined,
            // weekdaysLetter: (angular.isDefined(weekdaysLetter)) ? weekdaysLetter : undefined,
            // firstDay: (angular.isDefined(scope.firstDay)) ? scope.firstDay : 0,                                
            // disable: (angular.isDefined(scope.disable)) ? scope.disable : undefined,
            // today: (angular.isDefined(scope.today)) ? scope.today : undefined,
            // clear: (angular.isDefined(scope.clear)) ? scope.clear : undefined,
            // close: (angular.isDefined(scope.close)) ? scope.close : undefined,
            // selectYears: (angular.isDefined(scope.selectYears)) ? scope.selectYears : undefined,
            // onStart: (angular.isDefined(scope.onStart)) ? function(){ scope.onStart(); } : undefined,
            // onRender: (angular.isDefined(scope.onRender)) ? function(){ scope.onRender(); } : undefined,
            // onOpen: (angular.isDefined(scope.onOpen)) ? function(){ scope.onOpen(); } : undefined,
            // onClose: (angular.isDefined(scope.onClose)) ? function(){ scope.onClose(); } : undefined,
            // onSet: (angular.isDefined(scope.onSet)) ? function(){ scope.onSet(); } : undefined,
            // onStop: (angular.isDefined(scope.onStop)) ? function(){ scope.onStop(); } : undefined
        });

        //pickadate API
        var picker = pickadateInput.pickadate('picker');

      }
    };
  }]);
