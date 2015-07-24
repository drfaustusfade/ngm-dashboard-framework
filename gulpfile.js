/*
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
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


var gulp = require('gulp');
var connect = require('gulp-connect');
var modRewrite = require('connect-modrewrite');
var $ = require('gulp-load-plugins')();
var del = require('del');
var jsReporter = require('jshint-stylish');
var pkg = require('./package.json');
var name = pkg.name;

var templateOptions = {
  root: '../src/templates',
  module: 'adf'
};

var minifyHtmlOptions = {
  empty: true,
  loose: true
};

var ngdocOptions = {
  html5Mode: false,
  title: 'ADF API Documentation'
};

var protractorOptions = {
  configFile: 'protractor.conf.js'
};

/** lint **/

gulp.task('csslint', function(){
  gulp.src('src/styles/*.css')
      .pipe($.csslint())
      .pipe($.csslint.reporter());
});

gulp.task('jslint', function(){
  gulp.src('src/scripts/*.js')
      .pipe($.jshint())
      .pipe($.jshint.reporter(jsReporter));
});

gulp.task('lint', ['csslint', 'jslint']);

/** clean **/

gulp.task('clean', function(cb){
  del(['dist', '.tmp'], cb);
});

/** build **/

gulp.task('css', function(){
  gulp.src('src/styles/*.css')
      .pipe($.concat(name + '.css'))
      .pipe(gulp.dest('dist/'))
      .pipe($.rename(name + '.min.css'))
      .pipe($.minifyCss())
      .pipe(gulp.dest('dist/'));
});

gulp.task('js', function(){
  gulp.src(['src/scripts/*.js', 'src/templates/*.html'])
      .pipe($.if('*.html', $.minifyHtml(minifyHtmlOptions)))
      .pipe($.if('*.html', $.angularTemplatecache(name + '.tpl.js', templateOptions)))
      .pipe($.sourcemaps.init())
      .pipe($.if('*.js', $.replace('<<adfVersion>>', pkg.version)))
      .pipe($.if('*.js', $.replace(/'use strict';/g, '')))
      .pipe($.concat(name + '.js'))
      .pipe($.headerfooter('(function(window, undefined) {\'use strict\';\n', '})(window);'))
      .pipe(gulp.dest('dist/'))
      .pipe($.rename(name + '.min.js'))
      .pipe($.uglify())
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist/'));
});

gulp.task('build', ['css', 'js']);

/** build docs **/

gulp.task('docs', function(){
  return gulp.src('src/scripts/*.js')
    .pipe($.ngdocs.process(ngdocOptions))
    .pipe(gulp.dest('./dist/docs'));
});

/** shorthand methods **/
gulp.task('all', ['build', 'docs']);

gulp.task('default', ['build']);
