import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Input, Select, Space, Card, Tabs, Popconfirm, message, Modal } from 'antd'
import { EyeOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const statusMap = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  escalated: { text: '超时升级', color: 'red' }
}

export default function MyCourses() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [activeTab, setActiveTab] = useState('all')
  const [filters, setFilters] = useState({ keyword: '' })
  const [detailModal, setDetailModal] = useState({ open: false, record: null })

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, activeTab, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      }
      if (activeTab !== 'all') {
        params.status = activeTab
      }
      const res = await request.get('/enrollments/my', { params })
      setData(res.data?.list || [])
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id) => {
    try {
      await request.post(`/enrollments/${id}/cancel`)
      message.success('取消报名成功')
      loadData()
    } catch (e) {}
  }

  const handleViewDetail = (record) => {
    setDetailModal({ open: true, record })
  }

  const columns = [
    { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
    { title: '编码', dataIndex: 'course_code', key: 'course_code', width: 120 },
    { title: '学时', dataIndex: 'hours', key: 'hours', width: 80 },
    { title: '报名时间', dataIndex: 'apply_time', key: 'apply_time', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>详情</Button>
          {['pending', 'approved'].includes(r.status) && (
            <Popconfirm title="确定取消报名？" onConfirm={() => handleCancel(r.id)}>
              <Button type="link" danger icon={<CloseOutlined />}>取消报名</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const tabItems = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待审批' },
    { key: 'approved', label: '已通过' },
    { key: 'completed', label: '已完成' }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">我的培训</h2>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索课程名称/编码"
            style={{ width: 240 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => setPagination({ ...pagination, current: p, pageSize: ps })
          }}
        />
      </Card>

      <Modal
        title="报名详情"
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, record: null })}
        footer={[
          <Button key="close" onClick={() => setDetailModal({ open: false, record: null })}>关闭</Button>
        ]}
      >
        {detailModal.record && (
          <div className="detail-content">
            <p><strong>课程名称：</strong>{detailModal.record.course_name}</p>
            <p><strong>课程编码：</strong>{detailModal.record.course_code}</p>
            <p><strong>学时：</strong>{detailModal.record.hours} 学时</p>
            <p><strong>分类：</strong>{detailModal.record.category}</p>
            <p><strong>讲师：</strong>{detailModal.record.teacher}</p>
            <p><strong>开始时间：</strong>{detailModal.record.start_date}</p>
            <p><strong>结束时间：</strong>{detailModal.record.end_date}</p>
            <p><strong>报名时间：</strong>{detailModal.record.apply_time}</p>
            <p><strong>状态：</strong>
              <Tag color={statusMap[detailModal.record.status]?.color}>
                {statusMap[detailModal.record.status]?.text}
              </Tag>
            </p>
            {detailModal.record.approve_time && (
              <p><strong>审批时间：</strong>{detailModal.record.approve_time}</p>
            )}
            {detailModal.record.approver_name && (
              <p><strong>审批人：</strong>{detailModal.record.approver_name}</p>
            )}
            {detailModal.record.reject_reason && (
              <p><strong>拒绝原因：</strong>{detailModal.record.reject_reason}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
