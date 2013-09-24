module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-mocha-script');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.initConfig({
		mocha_script: {
			compile: {
				options: {},
				files: [{
                    expand: true,
                    cwd: 'app/mocha-scripts',
                    src: '{,*/}*.mocha',
                    dest: 'app/compiled-scripts',
                    ext: '.js'
                }]
			}
		},

		watch: {
			scripts: {
				files: ["app/mocha-scripts/{,*/}*.mocha"],
				tasks: ["compile"]
			}
		}
	});

	grunt.registerTask('compile', ['mocha_script']);
	grunt.registerTask('default', ['compile', 'watch']);
};
