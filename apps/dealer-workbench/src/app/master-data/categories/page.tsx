'use client';

import { useEffect, useState } from 'react';
import { ProductCategoryManagerCrudView } from '../../products/page';
import { auth } from '../../../lib/api';
import { getBrandProductPermissions, type BrandProductPermissions } from '../../../lib/brand-product-adapter';

const EMPTY_PERMISSIONS: BrandProductPermissions = {
  canCreateProduct: false,
  canUpdateProduct: false,
  canDeleteProduct: false,
  canPublishProduct: false,
  canCreateBrandLibrary: false,
  canUpdateBrandLibrary: false,
  canDeleteBrandLibrary: false,
  canPublishBrandLibrary: false,
  canAnyProductWrite: false,
  canAnyBrandWrite: false,
  canAnyWrite: false,
};

export default function MasterDataProductCategoriesPage() {
  const [permissions, setPermissions] = useState<BrandProductPermissions>(EMPTY_PERMISSIONS);

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setPermissions(getBrandProductPermissions(me));
      })
      .catch(() => {
        if (!cancelled) setPermissions(EMPTY_PERMISSIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: 'none', width: '100%', display: 'grid', gap: 16 }}>
      <ProductCategoryManagerCrudView
        canCreate={permissions.canCreateBrandLibrary}
        canUpdate={permissions.canUpdateBrandLibrary}
        canDelete={permissions.canDeleteBrandLibrary}
      />
    </div>
  );
}
