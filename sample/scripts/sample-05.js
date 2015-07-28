/* *
 * The MIT License
 *
 * Copyright (c) 2015, Sebastian Sdorra
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
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
'use strict';

angular.module('sample-05', ['adf', 'LocalStorageModule'])
.controller('sample05Ctrl', function($scope, localStorageService){

  var name = 'sample-05';
  var model = localStorageService.get(name);
  if (!model) {
    // set default model for demo purposes
    model = {
      title: "Sample 05",
      rows: [{
        columns: [{
          styleClass: "s4 m4 l4",
          widgets: [{
            type: "linklist",
            card: "card blue-grey darken-1 small",
            config: {
              links: [{
                title: "SCM-Manager",
                href: "http://www.scm-manager.org"
              }]
            },
            title: "Links"
          }]
        }, {
          styleClass: "s8 m8 l8",
          widgets: [{
            type: "randommsg",
            card: "card small",
            config: {},
            title: "Douglas Adams"
          }]
        }]
      }]
    };
  }
  $scope.name = name;
  $scope.model = model;
  $scope.collapsible = false;
  $scope.maximizable = false;

  $scope.$on('adfDashboardChanged', function (event, name, model) {
    localStorageService.set(name, model);
  });
});
