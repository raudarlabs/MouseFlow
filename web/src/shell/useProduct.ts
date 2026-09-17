/* Какой продукт сейчас в оболочке - и кто это решает.
 *
 * ДВА ИСТОЧНИКА, И ОДИН ИЗ НИХ СИЛЬНЕЕ, иначе неизбежно появляется состояние «я в make, а на экране
 * Tests»: адрес, если он принадлежит ровно одному продукту, и только в остальных случаях - выбор
 * человека. Открыв присланную ссылку на /tests, человек видит меню того продукта, в котором /tests
 * живёт, а не того, который он выбрал вчера, - и чинить рассогласование не приходится, потому что его
 * неоткуда взять.
 *
 * ВЫБОР - ПРЕДПОЧТЕНИЕ ОБ ЭТОМ БРАУЗЕРЕ, под тем же именованным ключом, что уже держат тема и ширина
 * бокового меню. НЕ в аккаунте нарочно: человек может держать два окна - в одном смотреть, как идёт
 * прогон, в другом писать документ, - и предпочтение, живущее на аккаунте, переключало бы ему второе
 * окно из первого. Тур свой признак держит в аккаунте по обратной причине: «я это уже видел» - правда о
 * человеке, а не об окне.
 *
 * Событие на window, а не контекст: переключатель один, читателей несколько, и провайдер ради одной
 * строки состояния - это лишний слой между ними.
 */
import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { DEFAULT_PRODUCT, PRODUCT_IDS, type Product, productAt } from '@/lib/product';

const KEY = 'mouseflow.product';
const CHANGED = 'mouseflow:product';

/** Выбор, как он записан в этом браузере. Экспортирован ради одного читателя вне React: корневой
 *  маршрут в main.tsx решает, куда вести с `/`, и делает это в `beforeLoad`, где хуков нет. */
export const storedProduct = (): Product => {
  try {
    const said = localStorage.getItem(KEY);
    return PRODUCT_IDS.includes(said as Product) ? (said as Product) : DEFAULT_PRODUCT;
  } catch (_) {
    /* Private mode: предпочтение не переживёт вкладку, но продукт всё равно есть. */
    return DEFAULT_PRODUCT;
  }
};

/** Запомнить выбор. Переход на домашний экран продукта делает тот, кто вызвал, - у навигации есть роутер,
 *  а у этой функции его нет, и тащить его сюда значило бы сделать хук непригодным вне дерева роутера. */
export const chooseProduct = (product: Product) => {
  try {
    localStorage.setItem(KEY, product);
  } catch (_) { /* private mode */ }
  window.dispatchEvent(new Event(CHANGED));
};

/** Продукт, которому подчиняется оболочка прямо сейчас, и его выбранная (а не выведенная) половина.
 *
 *  `chosen` нужен переключателю: он показывает, что выбрано, а не то, куда занесло адресом, - иначе
 *  галочка в списке прыгала бы при переходе на общий экран. */
export const useProduct = (): { product: Product; chosen: Product } => {
  const [chosen, setChosen] = useState<Product>(storedProduct);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const again = () => setChosen(storedProduct());
    window.addEventListener(CHANGED, again);
    /* И из другого окна того же браузера: `storage` приходит только туда, где не писали, что здесь и
     * нужно - окно, в котором переключили, уже узнало об этом из события выше. */
    window.addEventListener('storage', again);
    return () => {
      window.removeEventListener(CHANGED, again);
      window.removeEventListener('storage', again);
    };
  }, []);

  return { product: productAt(path) ?? chosen, chosen };
};
