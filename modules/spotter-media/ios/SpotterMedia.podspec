Pod::Spec.new do |s|
  s.name           = 'SpotterMedia'
  s.version        = '1.0.0'
  s.summary        = 'Music controls for Spotter (Apple Music on iPhone)'
  s.description    = 'Play, pause and skip for Apple Music during a workout.'
  s.author         = 'Spotter'
  s.homepage       = 'https://github.com/yeagx/spotter'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MediaPlayer'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
