'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TrendingUp, TrendingDown, Target, DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react'
import type { OverviewResponse } from '@/app/api/target/overview/route'
import type { DailyResponse } from '@/app/api/target/daily/route'

interface ProductDecision {
  sku: string
  status: 'pending' | 'keep' | 'cut' | 'watch' | 'restock'
  note?: string
  decided_at?: string
  updated_by?: string
  updated_at?: string
}

interface TargetDashboardProps {
  salesData?: any[]
  productsData?: any[]
}

const statusColors = {
  pending: 'bg-gray-500',
  keep: 'bg-green-500', 
  cut: 'bg-red-500',
  watch: 'bg-yellow-500',
  restock: 'bg-blue-500',
}

const statusLabels = {
  pending: 'รอตัดสินใจ',
  keep: 'เก็บ',
  cut: 'ตัด', 
  watch: 'เฝ้าดู',
  restock: 'เติม',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function TargetDashboard({}: TargetDashboardProps) {
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null)
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null)
  const [productDecisions, setProductDecisions] = useState<ProductDecision[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string>('pending')
  const [editingNote, setEditingNote] = useState<string>('')
  const [updating, setUpdating] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Fetch overview data
  useEffect(() => {
    async function fetchOverview() {
      try {
        const response = await fetch('/api/target/overview')
        if (!response.ok) {
          throw new Error(`Failed to fetch overview: ${response.statusText}`)
        }
        const data = await response.json()
        setOverviewData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch overview')
      }
    }

    fetchOverview()
  }, [])

  // Fetch daily data when date changes
  useEffect(() => {
    async function fetchDaily() {
      try {
        const response = await fetch(`/api/target/daily?date=${selectedDate}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch daily data: ${response.statusText}`)
        }
        const data = await response.json()
        setDailyData(data)
      } catch (err) {
        console.error('Failed to fetch daily data:', err)
        setDailyData(null)
      }
    }

    if (selectedDate) {
      fetchDaily()
    }
  }, [selectedDate])

  // Fetch product decisions
  useEffect(() => {
    async function fetchDecisions() {
      try {
        const response = await fetch('/api/target/product-decisions')
        if (!response.ok) {
          throw new Error(`Failed to fetch decisions: ${response.statusText}`)
        }
        const data = await response.json()
        setProductDecisions(data)
      } catch (err) {
        console.error('Failed to fetch product decisions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDecisions()
  }, [])

  const handleStatusUpdate = async () => {
    if (!editingSku) return
    
    setUpdating(true)
    try {
      const response = await fetch('/api/target/product-decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: editingSku,
          status: editingStatus,
          note: editingNote,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update product decision')
      }

      const result = await response.json()
      
      // Update local state optimistically
      setProductDecisions(prev => {
        const existing = prev.find(p => p.sku === editingSku)
        if (existing) {
          return prev.map(p => 
            p.sku === editingSku 
              ? { ...p, status: editingStatus as any, note: editingNote, updated_at: new Date().toISOString() }
              : p
          )
        } else {
          return [...prev, result.data]
        }
      })

      // Close modal
      setEditingSku(null)
      setEditingNote('')
      setEditingStatus('pending')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const openEditModal = (sku: string) => {
    const existing = productDecisions.find(p => p.sku === sku)
    setEditingSku(sku)
    setEditingStatus(existing?.status || 'pending')
    setEditingNote(existing?.note || '')
  }

  // Filter products by status
  const filteredDecisions = statusFilter === 'all' 
    ? productDecisions
    : productDecisions.filter(d => d.status === statusFilter)

  // Count by status
  const statusCounts = productDecisions.reduce((acc, decision) => {
    acc[decision.status] = (acc[decision.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Product Growth & Leak-Plug Dashboard</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="daily">รายวัน</TabsTrigger>
          <TabsTrigger value="decisions">ตัดสินใจ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {overviewData && (
            <>
              {/* Progress Bar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    ความคืบหน้าสู่เป้า +20%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={overviewData.targetProgress.progress * 100} className="h-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">รายได้ปัจจุบัน</p>
                        <p className="font-semibold">฿{formatCurrency(overviewData.targetProgress.current)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">เป้าหมาย</p>
                        <p className="font-semibold">฿{formatCurrency(overviewData.targetProgress.target)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">% ของเป้า</p>
                        <p className="font-semibold">{formatPercentage(overviewData.targetProgress.progress)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">ส่วนที่ยังต้องเติม</p>
                        <p className="font-semibold">฿{formatCurrency(overviewData.targetProgress.gap)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <div className="text-sm text-gray-600">รายได้ YoY</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold flex items-center gap-1">
                        {overviewData.kpis.revenueYoY >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        {formatPercentage(overviewData.kpis.revenueYoY)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <div className="text-sm text-gray-600">จำนวนชิ้น YoY</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold flex items-center gap-1">
                        {overviewData.kpis.unitsYoY >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        {formatPercentage(overviewData.kpis.unitsYoY)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-purple-500" />
                      <div className="text-sm text-gray-600">AOV</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold">฿{formatCurrency(overviewData.kpis.aov)}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        {overviewData.kpis.aovYoY >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        {formatPercentage(overviewData.kpis.aovYoY)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div className="text-sm text-gray-600">รูรั่วรวม</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold text-red-600">
                        ฿{formatCurrency(overviewData.kpis.totalLeak)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bridge Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Bridge Analysis: ส่วนต่าง YoY มาจากไหน</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">ของใหม่</div>
                      <div className="text-lg font-semibold text-green-600">
                        +฿{formatCurrency(overviewData.bridge.newGain)}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">ของหาย</div>
                      <div className="text-lg font-semibold text-red-600">
                        ฿{formatCurrency(overviewData.bridge.droppedLoss)}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">ฐานเดิมโต</div>
                      <div className="text-lg font-semibold text-green-600">
                        +฿{formatCurrency(overviewData.bridge.carriedUp)}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">ฐานเดิมหด</div>
                      <div className="text-lg font-semibold text-red-600">
                        ฿{formatCurrency(overviewData.bridge.carriedDown)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Gainers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Hero Gains วันนี้ vs ปีก่อน</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData?.gainers && dailyData.gainers.length > 0 ? (
                  <div className="space-y-3">
                    {dailyData.gainers.map((item) => (
                      <div key={item.sku} className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <div>
                          <div className="font-medium">{item.sku}</div>
                          <div className="text-sm text-gray-600">{item.productName}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            +฿{formatCurrency(item.delta)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(item.currentRevenue)} vs {formatCurrency(item.previousRevenue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">ไม่มีข้อมูล gains สำหรับวันที่เลือก</p>
                )}
              </CardContent>
            </Card>

            {/* Top Losers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Hero Decline วันนี้ vs ปีก่อน</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData?.losers && dailyData.losers.length > 0 ? (
                  <div className="space-y-3">
                    {dailyData.losers.map((item) => (
                      <div key={item.sku} className="flex justify-between items-center p-3 bg-red-50 rounded">
                        <div>
                          <div className="font-medium">{item.sku}</div>
                          <div className="text-sm text-gray-600">{item.productName}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-red-600">
                            ฿{formatCurrency(item.delta)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(item.currentRevenue)} vs {formatCurrency(item.previousRevenue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">ไม่มีข้อมูล declines สำหรับวันที่เลือก</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-6">
          {/* Status Filter and Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={statusFilter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                ทั้งหมด ({productDecisions.length})
              </Button>
              {Object.entries(statusCounts).map(([status, count]) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? '' : ''}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[status as keyof typeof statusColors]}`}></div>
                  {statusLabels[status as keyof typeof statusLabels]} ({count})
                </Button>
              ))}
            </div>
          </div>

          {/* Product Decisions Table */}
          <Card>
            <CardHeader>
              <CardTitle>การตัดสินใจสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDecisions.length > 0 ? (
                  filteredDecisions.map((decision) => (
                    <div 
                      key={decision.sku} 
                      className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => openEditModal(decision.sku)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${statusColors[decision.status]}`}></div>
                        <div>
                          <div className="font-medium">{decision.sku}</div>
                          {decision.note && (
                            <div className="text-sm text-gray-600">{decision.note}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">
                          {statusLabels[decision.status]}
                        </Badge>
                        {decision.updated_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(decision.updated_at).toLocaleDateString('th-TH')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">ไม่มีข้อมูลการตัดสินใจ</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={editingSku !== null} onOpenChange={() => setEditingSku(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขการตัดสินใจ: {editingSku}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">สถานะ</label>
              <Select value={editingStatus} onValueChange={setEditingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอตัดสินใจ</SelectItem>
                  <SelectItem value="keep">เก็บ</SelectItem>
                  <SelectItem value="cut">ตัด</SelectItem>
                  <SelectItem value="watch">เฝ้าดู</SelectItem>
                  <SelectItem value="restock">เติม</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">หมายเหตุ</label>
              <Textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="เพิ่มหมายเหตุ (ไม่บังคับ)"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSku(null)}>
                ยกเลิก
              </Button>
              <Button onClick={handleStatusUpdate} disabled={updating}>
                {updating ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}