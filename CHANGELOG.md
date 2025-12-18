## [2.0.0](https://github.com/IcrusaI/ts-router/compare/v1.1.1...v2.0.0) (2025-12-18)

### ⚠ BREAKING CHANGES

* изменены точки входа и типы — Router/Page/Layout теперь импортируются из src/router и src/components, старые классы и опции удалены; обновите маршруты, middleware и импорты,
  пересоберите проект.

* • feat!: переписать ядро роутинга, страницы и систему фич ([454b4f4](https://github.com/IcrusaI/ts-router/commit/454b4f441db38fc6d459e88527d0f40142d7ad98))

## [1.1.1](https://github.com/IcrusaI/ts-router/compare/v1.1.0...v1.1.1) (2025-10-29)

### Bug Fixes

* Поправлен баг при внесении изменений заголовка в методе created() ([9eb75dc](https://github.com/IcrusaI/ts-router/commit/9eb75dc65b49cc384b591070fdc51e18247048c9))

## [1.1.0](https://github.com/IcrusaI/ts-router/compare/v1.0.0...v1.1.0) (2025-10-29)

### Features

* Добавлена реактивность для заголовка страницы, добавлена возможность в renderStructure передавать строку html. Обновлена документация и примеры. ([bac476d](https://github.com/IcrusaI/ts-router/commit/bac476d77a916da4d159004a76f0f56f63427326))

## 1.0.0 (2025-09-19)

### Features

* initial public release ([d06ff66](https://github.com/IcrusaI/ts-router/commit/d06ff660aa2e7e1bf196273b5748f33b0d4a9309))
