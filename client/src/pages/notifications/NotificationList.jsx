import React, { useState, useEffect } from 'react'
import { Tabs, List, Card, Button, Space, Badge, Empty, message } from 'antd'
import {
  BellOutlined,
  BookOutlined,
  FileTextOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import request from '../../utils/request'

const { TabPane } = Tabs

const typeIconMap = {
  course: <BookOutlined style={{ color: '#1890ff', fontSize: 20 }} />,
  exam: <FileTextOutlined style={{ color: '#722ed1', fontSize: 20 }} />,
  certificate: <TrophyOutlined style={{ color: '#faad14', fontSize: 20 }} />,
  approval: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />,
  warning: <WarningOutlined style={{ color: '#fa8c16', fontSize: 20 }} />,
  system: <InfoCircleOutlined style={{ color: '#13c2c2', fontSize: 20 }} />,
  default: <BellOutlined style={{ color: '#8c8c8c', fontSize: 20 }} />
}

export default function NotificationList() {
  const [activeTab, setActiveTab] = useState('unread')
  const [unreadData, setUnreadData] = useState([])
  const [allData, setAllData] = useState([])
  const [unreadLoading, setUnreadLoading] = useState(false)
  const [allLoading, setAllLoading] = useState(false)
  const [unreadPagination, setUnreadPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [allPagination, setAllPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadUnreadData()
    loadUnreadCount()
  }, [unreadPagination.current, unreadPagination.pageSize])

  useEffect(() => {
    if (activeTab === 'all') {
      loadAllData()
    }
  }, [activeTab, allPagination.current, allPagination.pageSize])

  const loadUnreadCount = async () => {
    try {
      const res = await request.get('/notifications/unread-count')
      setUnreadCount(res.data?.count || 0)
    } catch (e) {}
  }

  const loadUnreadData = async () => {
    setUnreadLoading(true)
    try {
      const res = await request.get('/notifications', {
        params: {
          status: 'unread',
          page: unreadPagination.current,
          pageSize: unreadPagination.pageSize
        }
      })
      setUnreadData(res.data?.list || [])
      setUnreadPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setUnreadLoading(false)
    }
  }

  const loadAllData = async () => {
    setAllLoading(true)
    try {
      const res = await request.get('/notifications', {
        params: {
          page: allPagination.current,
          pageSize: allPagination.pageSize
        }
      })
      setAllData(res.data?.list || [])
      setAllPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setAllLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await request.put(`/notifications/${id}/read`)
      message.success('已标记为已读')
      if (activeTab === 'unread') {
        loadUnreadData()
      }
      loadUnreadCount()
    } catch (e) {}
  }

  const handleMarkAllAsRead = async () => {
    try {
      await request.put('/notifications/read-all')
      message.success('全部已标记为已读')
      loadUnreadData()
      loadAllData()
      loadUnreadCount()
    } catch (e) {}
  }

  const renderItem = (item, isUnreadTab) => (
    <List.Item
      key={item.id}
      onClick={() => isUnreadTab && handleMarkAsRead(item.id)}
      style={{
        cursor: isUnreadTab ? 'pointer' : 'default',
        background: item.status === 'unread' ? '#f0f8ff' : '#fff',
        borderLeft: item.status === 'unread' ? '3px solid #1890ff' : '3px solid transparent',
        paddingLeft: item.status === 'unread' ? '13px' : '16px'
      }}
    >
      <List.Item.Meta
        avatar={typeIconMap[item.type] || typeIconMap.default}
        title={
          <Space>
            {item.status === 'unread' && <Badge status="processing" color="#1890ff" />}
            <span style={{ fontWeight: item.status === 'unread' ? 600 : 400 }}>
              {item.title}
            </span>
          </Space>
        }
        description={
          <div>
            <div style={{ color: '#595959', marginBottom: 4 }}>{item.content}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12 }}>{item.created_at}</div>
          </div>
        }
      />
    </List.Item>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">消息通知</h2>
        <Space>
          {unreadCount > 0 && (
            <Button type="primary" onClick={handleMarkAllAsRead}>
              全部标为已读
            </Button>
          )}
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'unread',
              label: (
                <span>
                  未读消息
                  {unreadCount > 0 && (
                    <Badge
                      count={unreadCount}
                      size="small"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </span>
              ),
              children: (
                <List
                  loading={unreadLoading}
                  dataSource={unreadData}
                  renderItem={item => renderItem(item, true)}
                  locale={{ emptyText: <Empty description="暂无未读消息" /> }}
                  pagination={{
                    ...unreadPagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: t => `共 ${t} 条`,
                    onChange: (p, ps) => setUnreadPagination({ ...unreadPagination, current: p, pageSize: ps })
                  }}
                />
              )
            },
            {
              key: 'all',
              label: '全部消息',
              children: (
                <List
                  loading={allLoading}
                  dataSource={allData}
                  renderItem={item => renderItem(item, false)}
                  locale={{ emptyText: <Empty description="暂无消息" /> }}
                  pagination={{
                    ...allPagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: t => `共 ${t} 条`,
                    onChange: (p, ps) => setAllPagination({ ...allPagination, current: p, pageSize: ps })
                  }}
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}
