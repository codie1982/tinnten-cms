import NewsDetailPage from '../[id]/page';

// "Yeni haber" rotası — aynı detay sayfasını id=new ile açar
export default function NewNewsPage() {
  return <NewsDetailPage params={Promise.resolve({ id: 'new' })} />;
}
